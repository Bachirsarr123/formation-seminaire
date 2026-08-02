import { prisma } from '../prisma';

export interface VerrouillageEffectif {
  verrouilleLe: Date | null;
  aDesSoumissions: boolean;
  // Même prédicat que les triggers Postgres sur section/question (voir
  // migration 20260802123859) : verrouilleLe seul n'est qu'une date de
  // publication, pas encore un verrou. Ce qui fige la structure, c'est
  // verrouilleLe non nul ET au moins une réponse déjà reçue.
  structureModifiable: boolean;
}

/**
 * Reflète côté applicatif exactement la règle appliquée en base par les
 * triggers `section_verrouillage`/`question_verrouillage`, pour que le futur
 * éditeur organisateur puisse afficher le bon message ("encore modifiable,
 * aucune réponse reçue" vs "verrouillé définitivement") sans attendre
 * l'exception Postgres pour le découvrir.
 */
export async function verrouillageEffectif(questionnaireId: string): Promise<VerrouillageEffectif> {
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: questionnaireId },
    select: { verrouilleLe: true },
  });

  const uneSoumission = await prisma.soumission.findFirst({ where: { questionnaireId }, select: { id: true } });
  const aDesSoumissions = uneSoumission !== null;

  return {
    verrouilleLe: questionnaire.verrouilleLe,
    aDesSoumissions,
    structureModifiable: !(questionnaire.verrouilleLe !== null && aDesSoumissions),
  };
}
