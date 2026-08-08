import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { genererCsvResultatsAgreges } from '@/lib/organisateur/resultats';

// Accessible aux deux rôles (lecture seule pour le formateur), soumis au
// même seuil d'anonymat que l'écran — genererCsvResultatsAgreges renvoie
// `null` tant que le seuil n'est pas atteint, exactement comme la page.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const csv = await genererCsvResultatsAgreges(contexte.cabinetId, id, contexte);
  if (csv === null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="resultats-${seminaire.codePublic}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
