import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lireFichierSupport } from '@/lib/organisateur/stockage-supports';

// Seule l'extension (choisie par extensionDepuisNomFichier au moment de
// l'upload, lib/organisateur/stockage-supports.ts) permet de retrouver le
// type MIME ici : aucune colonne dédiée, `logoClientUrl` ne porte que le
// chemin de stockage — mêmes types que TYPES_MIME_LOGO_AUTORISES
// (lib/organisateur/logo-client.ts).
const TYPE_MIME_PAR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Public, sans authentification : même visibilité que la page /s/{codePublic}
// elle-même (un séminaire non publié ou supprimé n'expose pas son logo).
export async function GET(_request: Request, { params }: { params: Promise<{ codePublic: string }> }) {
  const { codePublic } = await params;

  const seminaire = await prisma.seminaire.findUnique({
    where: { codePublic },
    select: { logoClientUrl: true, statut: true, supprimeLe: true },
  });

  if (!seminaire || !seminaire.logoClientUrl || seminaire.statut === 'BROUILLON' || seminaire.supprimeLe !== null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const extension = seminaire.logoClientUrl.slice(seminaire.logoClientUrl.lastIndexOf('.'));
  const typeMime = TYPE_MIME_PAR_EXTENSION[extension] ?? 'application/octet-stream';
  const contenu = await lireFichierSupport(seminaire.logoClientUrl);

  return new NextResponse(new Uint8Array(contenu), {
    status: 200,
    headers: {
      'Content-Type': typeMime,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
