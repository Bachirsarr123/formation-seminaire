import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obtenirFichierCv } from '@/lib/organisateur/cv-formateur';

// Public, sans authentification : accessible depuis la page /s/{codePublic}
// (à côté du nom du formateur), donc même règle de visibilité que la page
// elle-même. `utilisateurId` n'est jamais accepté seul : il doit être un
// formateur RÉELLEMENT affecté à CE séminaire public via SeminaireFormateur,
// sans quoi n'importe quel id de formateur deviendrait devinable — pas de
// distinction 404 « séminaire introuvable » vs « CV introuvable », une seule
// réponse générique dans tous les cas.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codePublic: string; utilisateurId: string }> },
) {
  const { codePublic, utilisateurId } = await params;

  const seminaire = await prisma.seminaire.findUnique({
    where: { codePublic },
    select: { id: true, statut: true, supprimeLe: true },
  });
  if (!seminaire || seminaire.statut === 'BROUILLON' || seminaire.supprimeLe !== null) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const affectation = await prisma.seminaireFormateur.findUnique({
    where: { seminaireId_utilisateurId: { seminaireId: seminaire.id, utilisateurId } },
    select: { utilisateurId: true },
  });
  if (!affectation) {
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
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
