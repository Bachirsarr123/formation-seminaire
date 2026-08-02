import { afterAll, describe, expect, it } from 'vitest';
import { TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { inscrireParticipant } from '../../src/lib/inscription';
import { soumettreReponses } from '../../src/lib/soumission';
import { verrouillageEffectif } from '../../src/lib/questionnaire/verrouillage';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerQuestionnairePublie() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet verrouillage' } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire verrouillage',
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      statut: 'PUBLIE',
    },
  });
  const questionnaire = await prisma.questionnaire.create({
    data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Évaluation', statut: 'BROUILLON' },
  });
  const section = await prisma.section.create({
    data: { questionnaireId: questionnaire.id, titre: 'Général', ordre: 1 },
  });
  const question = await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, ordre: 1 },
  });

  // Le passage en PUBLIE pose verrouille_le (trigger questionnaire_verrouillage_auto).
  const publie = await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: { statut: 'PUBLIE' },
  });

  return { cabinet, seminaire, questionnaire: publie, section, question };
}

describe('Verrouillage structurel — verrouillé seulement dès la première réponse (pas à la publication seule)', () => {
  it('un questionnaire publié SANS aucune soumission reste modifiable', async () => {
    const { questionnaire, question } = await creerQuestionnairePublie();

    expect(questionnaire.verrouilleLe).not.toBeNull();

    const effectif = await verrouillageEffectif(questionnaire.id);
    expect(effectif.aDesSoumissions).toBe(false);
    expect(effectif.structureModifiable).toBe(true);

    await expect(
      prisma.question.update({ where: { id: question.id }, data: { intitule: 'Satisfaction globale (corrigée)' } }),
    ).resolves.toBeDefined();
  });

  it('dès la première soumission, la structure devient définitivement immuable (exception Postgres)', async () => {
    const { seminaire, questionnaire, section, question } = await creerQuestionnairePublie();

    const participant = await prisma.participant.create({
      data: { cabinetId: seminaire.cabinetId, nom: 'Test', prenom: 'Répondant', email: 'repondant@example.test' },
    });
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: 'MANUEL',
    });

    await soumettreReponses({
      jeton: inscription.jeton,
      questionnaireId: questionnaire.id,
      reponses: [{ questionId: question.id, valeurNumerique: 4 }],
    });

    const effectif = await verrouillageEffectif(questionnaire.id);
    expect(effectif.aDesSoumissions).toBe(true);
    expect(effectif.structureModifiable).toBe(false);

    await expect(
      prisma.question.update({ where: { id: question.id }, data: { intitule: 'Nouveau libellé' } }),
    ).rejects.toThrow();

    await expect(
      prisma.section.update({ where: { id: section.id }, data: { titre: 'Nouveau titre' } }),
    ).rejects.toThrow();

    await expect(
      prisma.question.create({
        data: { sectionId: section.id, intitule: 'Question ajoutée après coup', type: TypeQuestion.TEXTE_LIBRE, ordre: 2 },
      }),
    ).rejects.toThrow();

    await expect(prisma.question.delete({ where: { id: question.id } })).rejects.toThrow();
  });

  it("dateLimite et statut restent modifiables même après verrouillage définitif", async () => {
    const { seminaire, questionnaire, question } = await creerQuestionnairePublie();

    const participant = await prisma.participant.create({
      data: { cabinetId: seminaire.cabinetId, nom: 'Test', prenom: 'Répondante', email: 'repondante@example.test' },
    });
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: 'MANUEL',
    });
    await soumettreReponses({
      jeton: inscription.jeton,
      questionnaireId: questionnaire.id,
      reponses: [{ questionId: question.id, valeurNumerique: 5 }],
    });

    await expect(
      prisma.questionnaire.update({
        where: { id: questionnaire.id },
        data: { statut: 'FERME', dateLimite: new Date('2026-10-01') },
      }),
    ).resolves.toBeDefined();
  });

  it('verrouille_le, une fois posé, ne peut plus être ni effacé ni modifié', async () => {
    const { questionnaire } = await creerQuestionnairePublie();

    await expect(
      prisma.questionnaire.update({ where: { id: questionnaire.id }, data: { verrouilleLe: null } }),
    ).rejects.toThrow();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
