import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lireFichierSupportOuNull } from '@/lib/organisateur/stockage-supports';

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

  // `null` aussi bien si la ligne fichier_stocke n'existe pas (cas hérité
  // de l'ancien stockage disque) que pour un id valide mais absent —
  // même réponse « introuvable » qu'un logo jamais téléversé, jamais une
  // erreur brute non gérée.
  const fichier = await lireFichierSupportOuNull(cabinet.logoUrl);
  if (!fichier) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier.contenu), {
    status: 200,
    headers: {
      'Content-Type': fichier.typeMime,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
