import { afterAll, describe, expect, it } from 'vitest';
import {
  Modalite,
  SourceInscription,
  StatutQuestionnaire,
  StatutSeminaire,
  TypeQuestion,
} from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { annulerInscription, inscrireParticipant } from '../../src/lib/inscription';
import { SoumissionDejaEffectueeError, soumettreReponses } from '../../src/lib/soumission';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerJeuDeTest() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet de test' } });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire de test',
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });

  const questionnaire = await prisma.questionnaire.create({
    data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Évaluation', statut: StatutQuestionnaire.PUBLIE },
  });

  const section = await prisma.section.create({
    data: { questionnaireId: questionnaire.id, titre: 'Général', ordre: 1 },
  });

  const question = await prisma.question.create({
    data: {
      sectionId: section.id,
      intitule: 'Que pensez-vous de ce séminaire ?',
      type: TypeQuestion.TEXTE_LIBRE,
      ordre: 1,
    },
  });

  const participant = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Durand', prenom: 'Alex', email: 'alex@example.test' },
  });

  return {
    seminaireId: seminaire.id,
    participantId: participant.id,
    questionnaireId: questionnaire.id,
    questionId: question.id,
  };
}

describe("Cycle inscription / annulation / ré-inscription — anti-rejeu (AC4/AC5 étendu)", () => {
  it('un participant qui a déjà répondu ne peut plus répondre après une ré-inscription, et son jeton ne change jamais', async () => {
    const { seminaireId, participantId, questionnaireId, questionId } = await creerJeuDeTest();

    const premiereInscription = await inscrireParticipant({
      seminaireId,
      participantId,
      source: SourceInscription.MANUEL,
    });

    await soumettreReponses({
      jeton: premiereInscription.jeton,
      questionnaireId,
      reponses: [{ questionId, valeurTexte: 'Très utile, merci.' }],
    });

    const apresPremiereReponse = await prisma.inscription.findUniqueOrThrow({
      where: { id: premiereInscription.id },
    });
    expect(apresPremiereReponse.aRepondu).toBe(true);
    expect(apresPremiereReponse.aReponduLe).not.toBeNull();

    await annulerInscription(premiereInscription.id);
    const apresAnnulation = await prisma.inscription.findUniqueOrThrow({
      where: { id: premiereInscription.id },
    });
    expect(apresAnnulation.statut).toBe('ANNULEE');

    const reinscription = await inscrireParticipant({
      seminaireId,
      participantId,
      source: SourceInscription.MANUEL,
    });

    // Même ligne réutilisée (Règle : pas de nouvelle ligne à la ré-inscription)
    // ET même jeton : c'est l'identité durable du lien, jamais régénérée par
    // une ré-inscription (seule une action explicite de l'organisateur le
    // pourrait, en cas de suspicion de fuite — hors périmètre ici).
    expect(reinscription.id).toBe(premiereInscription.id);
    expect(reinscription.jeton).toBe(premiereInscription.jeton);
    expect(reinscription.statut).toBe('CONFIRMEE');

    // aRepondu / aReponduLe conservés tels quels malgré le cycle complet.
    expect(reinscription.aRepondu).toBe(true);
    expect(reinscription.aReponduLe).toEqual(apresPremiereReponse.aReponduLe);

    await expect(
      soumettreReponses({
        jeton: reinscription.jeton,
        questionnaireId,
        reponses: [{ questionId, valeurTexte: 'Nouvelle tentative avec le même jeton.' }],
      }),
    ).rejects.toThrow(SoumissionDejaEffectueeError);

    // Aucune deuxième soumission n'a été enregistrée.
    const soumissions = await prisma.soumission.count({ where: { questionnaireId } });
    expect(soumissions).toBe(1);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
