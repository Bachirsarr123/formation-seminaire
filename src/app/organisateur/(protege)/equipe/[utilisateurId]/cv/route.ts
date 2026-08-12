import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirFichierCv } from '@/lib/organisateur/cv-formateur';
import { prisma } from '@/lib/prisma';

// Réservé aux organisateurs du même cabinet (règle B) — permet de vérifier
// ce qui a été téléversé depuis l'écran Équipe.
export async function GET(_request: Request, { params }: { params: Promise<{ utilisateurId: string }> }) {
  const { utilisateurId } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const formateur = await prisma.utilisateur.findFirst({
    where: { id: utilisateurId, cabinetId: contexte.cabinetId },
    select: { id: true },
  });
  if (!formateur) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const fichier = await obtenirFichierCv(utilisateurId);
  if (!fichier) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const nomAscii = fichier.nomFichier.replace(/[^\x20-\x7E]/g, '_');

  return new NextResponse(new Uint8Array(fichier.contenu), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(fichier.nomFichier)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
