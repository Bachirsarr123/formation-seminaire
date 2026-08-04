import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { genererCsvInscriptions } from '@/lib/organisateur/export-participants';

// Route Handler : ne passe PAS par layout.tsx (protection des pages
// uniquement) — la session doit être vérifiée explicitement ici, comme
// toute action de l'espace organisateur (cf. commentaire dans middleware.ts
// sur la portée du rafraîchissement de cookie). Accessible aux deux rôles :
// lecture seule, comme le tableau de la page participants.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const csv = await genererCsvInscriptions(contexte.cabinetId, id);
  if (csv === null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="participants-${seminaire.codePublic}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
