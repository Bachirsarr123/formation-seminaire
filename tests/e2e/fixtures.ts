// Codes générés par scripts/fixtures-qa.ts (séminaires à dates futures,
// nécessaires car les séminaires du seed principal sont tous déjà passés
// par rapport à la date courante). Fixtures jetables, à recréer si la base
// de test est réinitialisée.
export const CODE_PUBLIC_BLEU = 'LM909w9dhA';
export const CODE_PUBLIC_VERT = 'd5RRP2HPan';
export const CODE_PUBLIC_ORANGE = 'z_ZxTqAsux';
export const CODE_PUBLIC_COMPLET = 'm_CfXZdz10';
export const CODE_PUBLIC_FERME = 'o0J_vvi0pU';
export const JETON_ANNULE = 'iK2EcEQM_MNy_CJ-SASbe';
// Séminaire terminé (phase APRES), questionnaire publié, jamais répondu —
// voir scripts/fixtures-qa.ts. Deux jetons distincts : chaque test e2e doit
// partir d'un jeton jamais utilisé (une soumission consomme aRepondu).
export const JETON_QUESTIONNAIRE = 'u7B_TeROEeKMJbyY9aXpL';
export const JETON_QUESTIONNAIRE_VALIDATION = 'OCmrdmqfFl6zaJQcsiuY7';

/**
 * En local, toutes les requêtes Playwright arrivent sans en-tête
 * `x-forwarded-for` et retombent donc sur la même IP factice côté serveur
 * (lib/anti-spam.ts) — plusieurs runs de suite finissent par déclencher la
 * limite de 5 inscriptions / 10 min, comme il se doit pour une vraie IP,
 * mais ça collisionne entre tests qui n'ont rien à voir. Chaque test qui
 * s'inscrit doit donner une IP factice distincte.
 */
export function ipFactice(): string {
  const suffixe = Math.floor(Math.random() * 65000);
  return `10.${Math.floor(suffixe / 256)}.${suffixe % 256}.${Math.floor(Math.random() * 254) + 1}`;
}
