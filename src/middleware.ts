import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Se limite à l'en-tête Referrer-Policy, sur /p/* ET /mon-espace. La
 * résolution du jeton/cookie se fait dans les routes elles-mêmes (route.ts,
 * page.tsx), en runtime Node.js — seul environnement où Prisma/PostgreSQL
 * fonctionne. Le Middleware Next.js tourne par défaut sur l'Edge Runtime,
 * incompatible avec une connexion TCP Postgres classique ; on ne l'y force
 * donc pas plutôt que de parier sur un flag expérimental.
 *
 * Sans cet en-tête, un clic sur un lien externe depuis /p/{jeton} ou
 * /mon-espace transmet des informations dans l'en-tête Referer du
 * navigateur cible.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export const config = {
  matcher: ['/p/:path*', '/mon-espace'],
};
