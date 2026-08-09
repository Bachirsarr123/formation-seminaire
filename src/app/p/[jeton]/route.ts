import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { poserCookieSession } from '@/lib/session';
import { construireOrigineRequete } from '@/lib/origine-requete';

interface Props {
  params: Promise<{ jeton: string }>;
}

/**
 * Le jeton ne s'affiche plus jamais dans une barre d'adresse : cette route
 * le résout, pose le cookie de session (httpOnly), puis redirige vers
 * /mon-espace sans lui dans l'URL.
 *
 * 404 réservé aux jetons inconnus ou expirés — une inscription ANNULEE
 * résout normalement (voir contexte-participant.ts) : /mon-espace affichera
 * l'état annulé et un bouton pour se réinscrire, pas une page introuvable.
 *
 * Jamais de log ici : ni `jeton`, ni la query string, ni rien qui en dérive.
 */
export async function GET(request: Request, { params }: Props) {
  const { jeton } = await params;

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return new NextResponse(null, { status: 404 });
  }

  await poserCookieSession(jeton, contexte.seminaire.dateFin);

  // `request.url` ne doit JAMAIS servir de base ici : derrière le proxy
  // Render, il reflète l'URL interne que Next.js s'est construite (observé
  // en production : `http://localhost:PORT/...`), pas l'origine publique
  // réellement visitée — même piège que celui documenté dans
  // lib/origine-requete.ts pour les liens/QR codes, cette fois sur une
  // redirection plutôt qu'un lien affiché.
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);

  return NextResponse.redirect(new URL('/mon-espace', origine));
}
