import 'server-only';
import { type Prisma, type Questionnaire, StatutQuestionnaire } from '@prisma/client';
import { prisma } from '../prisma';

export class QuestionnaireIntrouvableError extends Error {
  constructor() {
    super('Questionnaire introuvable.');
    this.name = 'QuestionnaireIntrouvableError';
  }
}

/**
 * Duplication générique : sert à la fois « dupliquer un modèle » (bibliothèque)
 * et « dupliquer après verrouillage » (éditeur, une fois qu'une première
 * réponse a figé la structure — lib/questionnaire/verrouillage.ts). Un seul
 * document verrouillé, jamais modifiable ; la seule voie est un nouveau
 * questionnaire, prêt à être repris.
 *
 * Conserve estModele/seminaireId du document DUPLIQUÉ (dupliquer un modèle
 * produit un nouveau modèle ; dupliquer le questionnaire d'un séminaire
 * produit un nouveau questionnaire attaché au MÊME séminaire). Reporte
 * modeleOrigineId de la SOURCE (jamais l'id de la source elle-même) : ça
 * préserve le groupe de comparaison inter-séminaires, qui ne regarde que le
 * modèle d'origine réel — dupliquer un questionnaire déjà issu du modèle M
 * doit rester comparable aux autres séminaires issus de M, pas devenir un
 * groupe à part.
 *
 * `moduleId` des questions n'est jamais reporté quand la source est un modèle
 * (même raison que copierModeleVersSeminaire : un modèle n'a pas de module) ;
 * il L'EST quand la source est déjà le questionnaire d'un séminaire, puisque
 * le module référencé appartient à ce même séminaire et reste valide dans la
 * copie.
 */
export async function dupliquerQuestionnaire(cabinetId: string, questionnaireId: string): Promise<Questionnaire> {
  const source = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, cabinetId, supprimeLe: null },
    include: {
      sections: {
        orderBy: { ordre: 'asc' },
        include: { questions: { where: { supprimeLe: null }, orderBy: { ordre: 'asc' } } },
      },
    },
  });

  if (!source) throw new QuestionnaireIntrouvableError();

  return prisma.questionnaire.create({
    data: {
      cabinetId,
      estModele: source.estModele,
      seminaireId: source.seminaireId,
      nom: source.estModele ? `${source.nom} (copie)` : null,
      titre: `${source.titre} (copie)`,
      modeleOrigineId: source.modeleOrigineId,
      statut: StatutQuestionnaire.BROUILLON,
      sections: {
        create: source.sections.map((section) => ({
          titre: section.titre,
          description: section.description,
          ordre: section.ordre,
          questions: {
            create: section.questions.map((question) => ({
              intitule: question.intitule,
              description: question.description,
              type: question.type,
              obligatoire: question.obligatoire,
              ordre: question.ordre,
              options: (question.options ?? undefined) as Prisma.InputJsonValue | undefined,
              autoriseSansOpinion: question.autoriseSansOpinion,
              moduleId: source.estModele ? undefined : question.moduleId,
            })),
          },
        })),
      },
    },
  });
}
