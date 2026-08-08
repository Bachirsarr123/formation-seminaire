import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { genererCsvReponsesBrutes } from '@/lib/organisateur/resultats';

// Réponses brutes SANS donnée identifiante (ni identifiant, ni date, lignes
// mélangées — voir genererCsvReponsesBrutes) : accessible aux deux rôles,
// soumis au même seuil d'anonymat que l'écran.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const csv = await genererCsvReponsesBrutes(contexte.cabinetId, id, contexte);
  if (csv === null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reponses-brutes-${seminaire.codePublic}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
