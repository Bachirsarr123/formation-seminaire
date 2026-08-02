// Codes générés par scripts/fixtures-qa.ts (séminaires à dates futures,
// nécessaires car les séminaires du seed principal sont tous déjà passés
// par rapport à la date courante). Fixtures jetables, à recréer si la base
// de test est réinitialisée.
export const CODE_PUBLIC_BLEU = '476NEa1Wb6';
export const CODE_PUBLIC_VERT = '1V0p6fITR3';
export const CODE_PUBLIC_ORANGE = 'iLI059a90E';
export const CODE_PUBLIC_COMPLET = '1rRGCFSYVm';
export const CODE_PUBLIC_FERME = 'M_muySEADS';
export const JETON_ANNULE = 'uXNIb0mYWRFLY3VRsCQJK';
// Séminaire terminé (phase APRES), questionnaire publié, jamais répondu —
// voir scripts/fixtures-qa.ts. Deux jetons distincts : chaque test e2e doit
// partir d'un jeton jamais utilisé (une soumission consomme aRepondu).
export const JETON_QUESTIONNAIRE = '_enwVqisrHqZzBrYfb5M2';
export const JETON_QUESTIONNAIRE_VALIDATION = 'c29q7ncJtuflwhmitOX4W';

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
