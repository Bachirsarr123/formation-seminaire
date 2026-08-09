import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DUREE_SESSION_MS, NOM_COOKIE_SESSION } from './lib/organisateur/cookie-session';

/**
 * Se limite à l'en-tête Referrer-Policy, sur /p/*, /mon-espace, /f/* ET
 * /organisateur/*. La résolution du jeton/cookie se fait dans les routes
 * elles-mêmes (route.ts, page.tsx), en runtime Node.js — seul environnement
 * où Prisma/PostgreSQL fonctionne. Le Middleware Next.js tourne par défaut
 * sur l'Edge Runtime, incompatible avec une connexion TCP Postgres
 * classique ; on ne l'y force donc pas plutôt que de parier sur un flag
 * expérimental.
 *
 * Sans cet en-tête, un clic sur un lien externe depuis /p/{jeton},
 * /mon-espace ou /organisateur transmet des informations dans l'en-tête
 * Referer du navigateur cible.
 *
 * Sur /organisateur/*, rafraîchit aussi optimistement le Max-Age du cookie
 * de session (12h glissantes) : resoudreSessionOrganisateur() prolonge déjà
 * `expiresAt` en base à chaque résolution, mais ne peut jamais réécrire le
 * cookie lui-même depuis une simple page (cookies().set() est interdit hors
 * Server Action/Route Handler). Le Middleware est le seul point qui tourne
 * sur CHAQUE requête et peut légitimement réécrire un cookie — c'est le
 * pattern documenté par Next.js pour une session glissante. Rafraîchir ici
 * ne vérifie rien contre la base (Edge, pas de Prisma) : c'est purement
 * optimiste, la validité réelle reste tranchée côté Node à chaque page/action.
 */
// Une valeur d'en-tête Origin "présente mais pas une URL absolue" (le cas
// littéral `null` inclus — sérialisation standard d'une origine opaque au
// sens de la spec Fetch, pas forcément une attaque) fait planter le
// dispatch interne des Server Actions de Next.js (`TypeError [ERR_INVALID_
// URL]`) avant même que le code de l'action ne s'exécute : aucun try/catch
// dans une action ne peut l'intercepter, seul le Middleware tourne assez tôt
// pour l'empêcher (lot 4, étape 8 — bug isolé sur `modifierSeminaireAction`,
// reproductible dès l'étape 6, donc dans Next lui-même, pas notre code).
//
// Rejet volontairement strict (échec fermé) plutôt qu'une tentative de
// "réparer" la requête (ex. retirer l'en-tête pour la laisser continuer) :
// on ne sait pas avec certitude comment le code interne de Next traiterait
// une origine absente dans ce contexte, et affaiblir sans certitude une
// vérification qui ressemble à une protection CSRF serait pire que le crash
// qu'on corrige. Une origine ABSENTE n'est volontairement pas concernée :
// seule une valeur présente mais invalide déclenche le rejet.
function estOriginAnalysable(origin: string): boolean {
  if (origin === 'null') return false;
  try {
    new URL(origin);
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/organisateur') && request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (origin !== null && !estOriginAnalysable(origin)) {
      return NextResponse.json(
        { error: "Requête invalide (origine non reconnue) : rechargez la page et réessayez." },
        { status: 400 },
      );
    }
  }

  const response = NextResponse.next();
  response.headers.set('Referrer-Policy', 'no-referrer');

  if (request.nextUrl.pathname.startsWith('/organisateur')) {
    const jeton = request.cookies.get(NOM_COOKIE_SESSION)?.value;
    if (jeton) {
      response.cookies.set(NOM_COOKIE_SESSION, jeton, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: DUREE_SESSION_MS / 1000,
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/p/:path*', '/mon-espace', '/organisateur/:path*', '/r/:path*', '/rc/:path*', '/f/:path*'],
};
