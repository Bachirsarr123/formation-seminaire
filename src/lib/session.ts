import 'server-only';
import { cookies } from 'next/headers';

const NOM_COOKIE_SESSION = 'seminaire_session';
const QUATRE_VINGT_DIX_JOURS_SECONDES = 90 * 24 * 3600;

/**
 * Le cookie porte le jeton d'inscription lui-même, tel quel : ce n'est pas un
 * nouveau secret de session à gérer côté serveur, seulement le même jeton
 * (Règle 1) déplacé d'un canal qui fuit (URL — historique, Referer, captures
 * d'écran, logs) vers un canal qui ne fuit pas. `httpOnly` empêche déjà toute
 * lecture par un script, donc pas besoin de signer/chiffrer la valeur en plus.
 *
 * Durée : fin du séminaire + 90 jours. Plancher à 90 jours à partir de
 * maintenant pour un séminaire déjà ancien (ex. ARCHIVE), où la formule brute
 * donnerait une durée déjà négative.
 */
export async function poserCookieSession(jeton: string, dateFin: Date): Promise<void> {
  const maintenant = Date.now();
  const dureeBrute = Math.floor((dateFin.getTime() - maintenant) / 1000) + QUATRE_VINGT_DIX_JOURS_SECONDES;
  const maxAge = Math.max(dureeBrute, QUATRE_VINGT_DIX_JOURS_SECONDES);

  const magasin = await cookies();
  magasin.set(NOM_COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function lireJetonSession(): Promise<string | null> {
  const magasin = await cookies();
  return magasin.get(NOM_COOKIE_SESSION)?.value ?? null;
}
