import type { TypeRecueilQuestion } from '@prisma/client';

/**
 * Convention de `RecueilQuestion.options` (Json) pour CHOIX_UNIQUE/
 * CHOIX_MULTIPLE — même forme que `question.options.choix` du questionnaire
 * d'évaluation (lib/questionnaire/echelles.ts), volontairement dupliquée
 * plutôt que partagée : les deux lots ne doivent jamais dépendre l'un de
 * l'autre, même par un import commun qui les coupler discrètement.
 * `avecAutre` n'a de sens que pour CHOIX_MULTIPLE (voir mockup organisateur) :
 * une case « Autre » supplémentaire, avec un champ texte libre associé.
 */
export interface OptionsRecueilChoix {
  choix: { id: string; libelle: string }[];
  avecAutre?: boolean;
}

export function choixRecueil(options: unknown): OptionsRecueilChoix['choix'] {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
  const choix = (options as Record<string, unknown>).choix;
  return Array.isArray(choix) ? (choix as OptionsRecueilChoix['choix']) : [];
}

export function avecAutreRecueil(options: unknown): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false;
  return (options as Record<string, unknown>).avecAutre === true;
}

/**
 * Traduit une valeur brute stockée dans RecueilReponse.reponses (un id de
 * choix, ou un texte libre pour "Autre"/TEXTE_LIBRE) en libellé lisible pour
 * la consultation formateur — un id qui ne correspond plus à aucun choix
 * déclaré (question modifiée depuis) est affiché tel quel plutôt que de
 * faire disparaître silencieusement une réponse déjà donnée.
 */
export function libelleChoixRecueil(options: unknown, idOuTexte: string): string {
  const trouve = choixRecueil(options).find((c) => c.id === idOuTexte);
  return trouve?.libelle ?? idOuTexte;
}

/**
 * Met en forme une valeur brute de RecueilReponse.reponses[questionId] pour
 * l'affichage — un tableau (une seule entrée pour TEXTE_LIBRE/CHOIX_UNIQUE,
 * plusieurs pour CHOIX_MULTIPLE) pour que les trois écrans qui affichent des
 * réponses (consultation formateur, écran organisateur, export Excel) ne
 * réimplémentent pas chacun la même traduction id → libellé.
 */
export function libellesReponseRecueil(
  question: { type: TypeRecueilQuestion; options: unknown },
  valeur: string | string[] | undefined,
): string[] {
  if (valeur === undefined) return [];
  if (Array.isArray(valeur)) return valeur.map((v) => libelleChoixRecueil(question.options, v));
  if (question.type === 'TEXTE_LIBRE') return [valeur];
  return [libelleChoixRecueil(question.options, valeur)];
}
