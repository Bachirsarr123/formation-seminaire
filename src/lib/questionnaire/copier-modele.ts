import type { Prisma, Questionnaire } from '@prisma/client';
import { prisma } from '../prisma';

export class ModeleInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModeleInvalideError';
  }
}

/**
 * Un modèle est un questionnaire comme les autres (schema.prisma), simplement
 * détaché d'un séminaire — pas de tables ModeleQuestionnaire/Section/Question
 * en miroir. Créer le questionnaire d'un séminaire = copie profonde d'un
 * modèle (sections, questions, options, ordre), `modeleOrigineId` renseigné
 * pour la traçabilité. Servira à l'espace organisateur (pas encore écrit).
 *
 * Sections/questions supprimées logiquement du modèle ne sont jamais copiées.
 * `moduleId` n'est jamais reporté : un modèle n'est rattaché à aucun
 * séminaire, donc à aucun module — reporter une valeur pointerait vers un
 * module d'un séminaire sans rapport avec celui qui reçoit la copie.
 */
export async function copierModeleVersSeminaire(modeleId: string, seminaireId: string): Promise<Questionnaire> {
  const modele = await prisma.questionnaire.findUnique({
    where: { id: modeleId },
    include: {
      sections: {
        orderBy: { ordre: 'asc' },
        include: {
          questions: {
            where: { supprimeLe: null },
            orderBy: { ordre: 'asc' },
          },
        },
      },
    },
  });

  if (!modele || !modele.estModele) {
    throw new ModeleInvalideError(`Modèle introuvable ou invalide : ${modeleId}`);
  }

  const seminaire = await prisma.seminaire.findUniqueOrThrow({
    where: { id: seminaireId },
    select: { cabinetId: true },
  });

  if (seminaire.cabinetId !== modele.cabinetId) {
    throw new ModeleInvalideError("Le modèle et le séminaire n'appartiennent pas au même cabinet.");
  }

  return prisma.questionnaire.create({
    data: {
      cabinetId: seminaire.cabinetId,
      seminaireId,
      estModele: false,
      modeleOrigineId: modele.id,
      titre: modele.titre,
      dateLimite: modele.dateLimite,
      sections: {
        create: modele.sections.map((section) => ({
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
            })),
          },
        })),
      },
    },
  });
}
