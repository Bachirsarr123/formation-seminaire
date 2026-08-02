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
