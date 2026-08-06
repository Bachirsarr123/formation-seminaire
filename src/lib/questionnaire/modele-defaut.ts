import 'server-only';
import { StatutQuestionnaire, TypeQuestion, type Questionnaire } from '@prisma/client';
import { prisma } from '../prisma';

const NOM_MODELE_DEFAUT = 'Évaluation à chaud';

/**
 * Modèle par défaut créé pour tout nouveau cabinet (seed de démonstration ET
 * initialisation de production, scripts/initialiser-production.ts) : sans
 * lui, le premier passage par la bibliothèque de questionnaires affronte une
 * page blanche. Six questions dans deux sections (lot 5) — source unique de
 * ce contenu, pour que les deux scripts ne divergent jamais.
 */
export async function creerModeleEvaluationParDefaut(cabinetId: string): Promise<Questionnaire> {
  const modele = await prisma.questionnaire.create({
    data: {
      cabinetId,
      estModele: true,
      nom: NOM_MODELE_DEFAUT,
      titre: NOM_MODELE_DEFAUT,
      statut: StatutQuestionnaire.BROUILLON,
    },
  });

  const sectionEvaluation = await prisma.section.create({
    data: { questionnaireId: modele.id, titre: 'Évaluation', ordre: 1 },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionEvaluation.id,
      intitule: 'Satisfaction globale',
      type: TypeQuestion.NOTE_5,
      obligatoire: true,
      ordre: 1,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionEvaluation.id,
      intitule: "Qualité de l'animation",
      type: TypeQuestion.NOTE_5,
      obligatoire: false,
      ordre: 2,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionEvaluation.id,
      intitule: 'Contenu',
      type: TypeQuestion.NOTE_5,
      obligatoire: false,
      ordre: 3,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionEvaluation.id,
      intitule: 'Organisation matérielle',
      type: TypeQuestion.ECHELLE_4,
      obligatoire: false,
      // Une Likert sans intitulé ne veut rien dire pour le répondant.
      options: {
        libelles: {
          '1': 'Pas du tout satisfait·e',
          '2': 'Plutôt pas satisfait·e',
          '3': 'Plutôt satisfait·e',
          '4': 'Tout à fait satisfait·e',
        },
      },
      // Tout le monde ne se prononce pas sur la logistique : « sans opinion »
      // évite de forcer un chiffre au hasard qui fausserait la moyenne.
      autoriseSansOpinion: true,
      ordre: 4,
    },
  });

  const sectionSuite = await prisma.section.create({
    data: { questionnaireId: modele.id, titre: 'Pour aller plus loin', ordre: 2 },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionSuite.id,
      intitule: 'Recommanderiez-vous ce séminaire ?',
      type: TypeQuestion.NPS,
      obligatoire: true,
      ordre: 1,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionSuite.id,
      intitule: 'Vos remarques libres',
      type: TypeQuestion.TEXTE_LIBRE,
      ordre: 2,
      obligatoire: false,
    },
  });

  return modele;
}
