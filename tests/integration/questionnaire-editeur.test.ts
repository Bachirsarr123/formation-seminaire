import { afterAll, describe, expect, it } from 'vitest';
import { TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  QuestionnaireIntrouvableError,
  StructureVerrouilleeError,
  ajouterQuestion,
  ajouterSection,
  deplacerQuestion,
  deplacerSection,
  modifierQuestion,
  obtenirQuestionnairePourEditeur,
  renommerSection,
  supprimerQuestion,
  supprimerSection,
} from '../../src/lib/questionnaire/editeur';
import { copierModeleVersSeminaire } from '../../src/lib/questionnaire/copier-modele';
import { inscrireParticipant } from '../../src/lib/inscription';
import { soumettreReponses } from '../../src/lib/soumission';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinet(nom: string) {
  return prisma.cabinet.create({ data: { nom } });
}

async function creerModeleVide(cabinetId: string, titre = 'Modèle') {
  return prisma.questionnaire.create({ data: { cabinetId, estModele: true, nom: titre, titre } });
}

async function creerSeminaire(cabinetId: string, titre: string) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre,
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      statut: 'PUBLIE',
    },
  });
}

describe('éditeur — structure (2 sections, 5 types de question, réordonnancement)', () => {
  it('construit une structure complète et la relit fidèlement', async () => {
    const cabinet = await creerCabinet('Cabinet éditeur — structure');
    const modele = await creerModeleVide(cabinet.id);

    const sectionA = await ajouterSection(cabinet.id, modele.id, { titre: 'Section A' });
    const sectionB = await ajouterSection(cabinet.id, modele.id, { titre: 'Section B' });
    expect(sectionA.ordre).toBe(1);
    expect(sectionB.ordre).toBe(2);

    const qNote = await ajouterQuestion(cabinet.id, sectionA.id, {
      intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, obligatoire: true, autoriseSansOpinion: false, options: null,
    });
    const qEchelle = await ajouterQuestion(cabinet.id, sectionA.id, {
      intitule: 'Logistique',
      type: TypeQuestion.ECHELLE_4,
      obligatoire: false,
      autoriseSansOpinion: true,
      options: { libelles: { '1': 'Mauvaise', '2': 'Passable', '3': 'Bonne', '4': 'Excellente' } },
    });
    await ajouterQuestion(cabinet.id, sectionB.id, {
      intitule: 'Format préféré',
      type: TypeQuestion.QCM_UNIQUE,
      obligatoire: true,
      autoriseSansOpinion: false,
      options: { choix: [{ id: 'opt-1', libelle: 'Présentiel' }, { id: 'opt-2', libelle: 'Distanciel' }] },
    });
    await ajouterQuestion(cabinet.id, sectionB.id, {
      intitule: 'Recommanderiez-vous ce séminaire ?', type: TypeQuestion.NPS, obligatoire: true, autoriseSansOpinion: false, options: null,
    });
    await ajouterQuestion(cabinet.id, sectionB.id, {
      intitule: 'Remarques', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null,
    });

    const structure = await obtenirQuestionnairePourEditeur(cabinet.id, modele.id);
    expect(structure!.sections).toHaveLength(2);
    expect(structure!.sections[0]!.questions.map((q) => q.type)).toEqual(['NOTE_5', 'ECHELLE_4']);
    expect(structure!.sections[1]!.questions.map((q) => q.type)).toEqual(['QCM_UNIQUE', 'NPS', 'TEXTE_LIBRE']);
    expect(structure!.sections[0]!.questions[1]!.options).toEqual({
      libelles: { '1': 'Mauvaise', '2': 'Passable', '3': 'Bonne', '4': 'Excellente' },
    });

    // Réordonnancement : monter la 2e section la place en 1re.
    await deplacerSection(cabinet.id, sectionB.id, 'HAUT');
    const apresDeplacement = await obtenirQuestionnairePourEditeur(cabinet.id, modele.id);
    expect(apresDeplacement!.sections[0]!.id).toBe(sectionB.id);
    expect(apresDeplacement!.sections[1]!.id).toBe(sectionA.id);

    // Monter la section déjà première : aucun effet, pas d'erreur.
    await expect(deplacerSection(cabinet.id, sectionB.id, 'HAUT')).resolves.toBeUndefined();

    // Réordonnancement d'une question au sein de sa section.
    await deplacerQuestion(cabinet.id, qEchelle.id, 'HAUT');
    const structureFinale = await obtenirQuestionnairePourEditeur(cabinet.id, modele.id);
    const sectionAFinale = structureFinale!.sections.find((s) => s.id === sectionA.id)!;
    expect(sectionAFinale.questions[0]!.id).toBe(qEchelle.id);
    expect(sectionAFinale.questions[1]!.id).toBe(qNote.id);
  });

  it('renommerSection et modifierQuestion modifient la copie sans affecter le modèle', async () => {
    const cabinet = await creerCabinet('Cabinet éditeur — copie indépendante');
    const modele = await creerModeleVide(cabinet.id, 'Modèle original');
    const section = await ajouterSection(cabinet.id, modele.id, { titre: 'Section originale' });
    const question = await ajouterQuestion(cabinet.id, section.id, {
      intitule: 'Intitulé original', type: TypeQuestion.NOTE_5, obligatoire: true, autoriseSansOpinion: false, options: null,
    });

    const seminaire = await creerSeminaire(cabinet.id, 'Séminaire copie');
    const copie = await copierModeleVersSeminaire(modele.id, seminaire.id);
    const structureCopie = await obtenirQuestionnairePourEditeur(cabinet.id, copie.id);
    const sectionCopie = structureCopie!.sections[0]!;
    const questionCopie = sectionCopie.questions[0]!;

    await renommerSection(cabinet.id, sectionCopie.id, { titre: 'Section modifiée' });
    await modifierQuestion(cabinet.id, questionCopie.id, {
      intitule: 'Intitulé modifié', type: TypeQuestion.NOTE_5, obligatoire: false, autoriseSansOpinion: false, options: null,
    });

    const sectionOriginaleRelue = await prisma.section.findUniqueOrThrow({ where: { id: section.id } });
    const questionOriginaleRelue = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(sectionOriginaleRelue.titre).toBe('Section originale');
    expect(questionOriginaleRelue.intitule).toBe('Intitulé original');
    expect(questionOriginaleRelue.obligatoire).toBe(true);

    const sectionCopieRelue = await prisma.section.findUniqueOrThrow({ where: { id: sectionCopie.id } });
    const questionCopieRelue = await prisma.question.findUniqueOrThrow({ where: { id: questionCopie.id } });
    expect(sectionCopieRelue.titre).toBe('Section modifiée');
    expect(questionCopieRelue.intitule).toBe('Intitulé modifié');
    expect(questionCopieRelue.obligatoire).toBe(false);
  });

  it('supprimerSection supprime physiquement (cascade sur ses questions), supprimerQuestion est purement logique', async () => {
    const cabinet = await creerCabinet('Cabinet éditeur — suppression');
    const modele = await creerModeleVide(cabinet.id);
    const section = await ajouterSection(cabinet.id, modele.id, { titre: 'À supprimer' });
    const question = await ajouterQuestion(cabinet.id, section.id, {
      intitule: 'Question à garder', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null,
    });
    const autreSection = await ajouterSection(cabinet.id, modele.id, { titre: 'Reste' });
    const autreQuestion = await ajouterQuestion(cabinet.id, autreSection.id, {
      intitule: 'À supprimer logiquement', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null,
    });

    await supprimerQuestion(cabinet.id, autreQuestion.id);
    const releQuestion = await prisma.question.findUniqueOrThrow({ where: { id: autreQuestion.id } });
    expect(releQuestion.supprimeLe).not.toBeNull(); // toujours en base, logique seulement.

    const structureApresSuppressionQuestion = await obtenirQuestionnairePourEditeur(cabinet.id, modele.id);
    expect(structureApresSuppressionQuestion!.sections.find((s) => s.id === autreSection.id)!.questions).toHaveLength(0);

    await supprimerSection(cabinet.id, section.id);
    expect(await prisma.section.findUnique({ where: { id: section.id } })).toBeNull(); // physique.
    expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull(); // cascade.
  });
});

describe('éditeur — verrouillage (message clair, jamais une erreur Postgres brute)', () => {
  async function creerQuestionnairePublieAvecReponse() {
    const cabinet = await creerCabinet('Cabinet éditeur — verrouillage');
    const seminaire = await creerSeminaire(cabinet.id, 'Séminaire verrouillage éditeur');
    const questionnaire = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Évaluation', statut: 'BROUILLON' },
    });
    const section = await prisma.section.create({ data: { questionnaireId: questionnaire.id, titre: 'Section', ordre: 1 } });
    const question = await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, ordre: 1 },
    });
    await prisma.questionnaire.update({ where: { id: questionnaire.id }, data: { statut: 'PUBLIE' } });

    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'Test', prenom: 'Verrouillage', email: `verrouillage.${Date.now()}@example.test` },
    });
    const inscription = await inscrireParticipant({ seminaireId: seminaire.id, participantId: participant.id, source: 'MANUEL' });
    await soumettreReponses({ jeton: inscription.jeton, questionnaireId: questionnaire.id, reponses: [{ questionId: question.id, valeurNumerique: 4 }] });

    return { cabinet, questionnaire, section, question };
  }

  it('toute mutation de structure est refusée avec StructureVerrouilleeError, jamais une exception Postgres brute', async () => {
    const { cabinet, questionnaire, section, question } = await creerQuestionnairePublieAvecReponse();

    await expect(ajouterSection(cabinet.id, questionnaire.id, { titre: 'Nouvelle' })).rejects.toThrow(StructureVerrouilleeError);
    await expect(renommerSection(cabinet.id, section.id, { titre: 'Renommée' })).rejects.toThrow(StructureVerrouilleeError);
    await expect(deplacerSection(cabinet.id, section.id, 'HAUT')).rejects.toThrow(StructureVerrouilleeError);
    await expect(supprimerSection(cabinet.id, section.id)).rejects.toThrow(StructureVerrouilleeError);
    await expect(
      ajouterQuestion(cabinet.id, section.id, { intitule: 'X', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null }),
    ).rejects.toThrow(StructureVerrouilleeError);
    await expect(
      modifierQuestion(cabinet.id, question.id, { intitule: 'Y', type: TypeQuestion.NOTE_5, obligatoire: false, autoriseSansOpinion: false, options: null }),
    ).rejects.toThrow(StructureVerrouilleeError);
    await expect(deplacerQuestion(cabinet.id, question.id, 'HAUT')).rejects.toThrow(StructureVerrouilleeError);
    await expect(supprimerQuestion(cabinet.id, question.id)).rejects.toThrow(StructureVerrouilleeError);

    // Message clair, explicite sur le pourquoi — pas un message technique.
    try {
      await ajouterSection(cabinet.id, questionnaire.id, { titre: 'Nouvelle' });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toMatch(/réponse a déjà été reçue/);
      expect((e as Error).message).toMatch(/dupliqu/i);
    }
  });
});

describe('éditeur — isolation cross-cabinet', () => {
  it("aucune fonction de mutation n'agit sur une ressource d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet('Cabinet éditeur — isolation A');
    const cabinetB = await creerCabinet('Cabinet éditeur — isolation B');
    const modeleA = await creerModeleVide(cabinetA.id);
    const sectionA = await ajouterSection(cabinetA.id, modeleA.id, { titre: 'Section A' });
    const questionA = await ajouterQuestion(cabinetA.id, sectionA.id, {
      intitule: 'Q A', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null,
    });

    await expect(ajouterSection(cabinetB.id, modeleA.id, { titre: 'Intrusion' })).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(renommerSection(cabinetB.id, sectionA.id, { titre: 'Intrusion' })).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(deplacerSection(cabinetB.id, sectionA.id, 'HAUT')).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(supprimerSection(cabinetB.id, sectionA.id)).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(
      ajouterQuestion(cabinetB.id, sectionA.id, { intitule: 'Intrusion', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null }),
    ).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(
      modifierQuestion(cabinetB.id, questionA.id, { intitule: 'Intrusion', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, autoriseSansOpinion: false, options: null }),
    ).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(deplacerQuestion(cabinetB.id, questionA.id, 'HAUT')).rejects.toThrow(QuestionnaireIntrouvableError);
    await expect(supprimerQuestion(cabinetB.id, questionA.id)).rejects.toThrow(QuestionnaireIntrouvableError);

    // Rien n'a bougé.
    expect(await prisma.section.findUnique({ where: { id: sectionA.id } })).not.toBeNull();
    const releQuestionA = await prisma.question.findUniqueOrThrow({ where: { id: questionA.id } });
    expect(releQuestionA.supprimeLe).toBeNull();
    expect(releQuestionA.intitule).toBe('Q A');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
