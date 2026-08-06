import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { construireLienPublicSeminaire, genererQrSvg } from '@/lib/organisateur/diffusion';
import { construireOrigineRequete } from '@/lib/origine-requete';

// Voir qr.png/route.ts : même garde, même source (lien public), autre
// format de sortie.
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
  const svg = await genererQrSvg(lien);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="qr-${seminaire.codePublic}.svg"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
