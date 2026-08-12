import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lireFichierSupport } from '@/lib/organisateur/stockage-supports';

// Même table extension → type MIME que /s/{codePublic}/logo-client (aucune
// colonne dédiée, `logoUrl` ne porte que le chemin de stockage).
const TYPE_MIME_PAR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Public, sans authentification : le logo du cabinet est une image de marque
// affichée sur toutes les pages publiques, jamais une donnée sensible.
export async function GET(_request: Request, { params }: { params: Promise<{ cabinetId: string }> }) {
  const { cabinetId } = await params;

  const cabinet = await prisma.cabinet.findUnique({
    where: { id: cabinetId },
    select: { logoUrl: true },
  });

  if (!cabinet || !cabinet.logoUrl) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const extension = cabinet.logoUrl.slice(cabinet.logoUrl.lastIndexOf('.'));
  const typeMime = TYPE_MIME_PAR_EXTENSION[extension] ?? 'application/octet-stream';
  const contenu = await lireFichierSupport(cabinet.logoUrl);

  return new NextResponse(new Uint8Array(contenu), {
    status: 200,
    headers: {
      'Content-Type': typeMime,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
