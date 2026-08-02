import { NextResponse } from 'next/server';
import { genererFluxIcsCabinet, resoudreCabinetParJetonFluxIcs } from '@/lib/organisateur/agenda';

// Hors du groupe (protege) : ce flux est interrogé par un client de
// messagerie (Outlook, Google Agenda), sans cookie de session — c'est le
// jeton en query string lui-même qui authentifie la requête. Ne journalise
// jamais `request.url` ni le jeton (aucun console.log/erreur qui les
// inclurait) : cette URL est un secret de longue durée.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jeton = searchParams.get('jeton') ?? '';

  const resolu = await resoudreCabinetParJetonFluxIcs(jeton);
  if (!resolu) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const ics = await genererFluxIcsCabinet(resolu.cabinetId);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="agenda.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
