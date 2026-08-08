import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { genererCsvNotations } from '@/lib/organisateur/notations';

// Accessible au formateur affecté et à l'organisateur, même règle d'accès
// que la page (voir genererCsvNotations -> obtenirNotationsSeminaire).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const csv = await genererCsvNotations(contexte.cabinetId, id, contexte);
  if (csv === null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="notations-${seminaire.codePublic}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
