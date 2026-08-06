import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { construireLienPublicSeminaire, genererQrPng } from '@/lib/organisateur/diffusion';
import { construireOrigineRequete } from '@/lib/origine-requete';

// Route Handler : ne passe PAS par layout.tsx (protection des pages
// uniquement) — session vérifiée explicitement ici, comme
// participants/export/route.ts. Accessible aux deux rôles : lecture seule,
// comme le reste de la fiche séminaire.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lien = construireLienPublicSeminaire(origine, seminaire.codePublic);
  const png = await genererQrPng(lien);

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${seminaire.codePublic}.png"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
