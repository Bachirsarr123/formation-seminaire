import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lireFichierSupportOuNull } from '@/lib/organisateur/stockage-supports';

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

  // `null` aussi bien si la ligne fichier_stocke n'existe pas (cas hérité
  // de l'ancien stockage disque) que pour un id valide mais absent —
  // même réponse « introuvable » qu'un logo jamais téléversé, jamais une
  // erreur brute non gérée.
  const fichier = await lireFichierSupportOuNull(seminaire.logoClientUrl);
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
