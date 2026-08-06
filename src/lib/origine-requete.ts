/**
 * Derrière un proxy inverse (Render, etc.), `Host` peut porter l'adresse
 * interne plutôt que le domaine public vu par le client — `X-Forwarded-Host`
 * est le seul en-tête garanti fiable pour reconstruire une URL publique
 * (lien d'inscription, QR code, lien magique). Repli sur `Host` seulement en
 * local (pas de proxy, donc pas de X-Forwarded-Host).
 */
export function construireOrigineRequete(enTetes: Headers): string {
  const protocole = enTetes.get('x-forwarded-proto') ?? 'https';
  const hote = enTetes.get('x-forwarded-host') ?? enTetes.get('host') ?? '';
  return `${protocole}://${hote}`;
}
