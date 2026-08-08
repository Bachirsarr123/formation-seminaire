import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirFichierSupportOrganisateur } from '@/lib/organisateur/supports';

// Même périmètre que la page (organisateur uniquement) : la gestion des
// supports n'est pas déléguée au formateur dans ce lot, le téléchargement
// non plus — cohérent avec l'absence de lien vers cet écran pour ce rôle.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; supportId: string }> }) {
  const { id, supportId } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = await obtenirFichierSupportOrganisateur(contexte.cabinetId, id, supportId);
  if (!fichier) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const nomAscii = fichier.nomFichier.replace(/[^\x20-\x7E]/g, '_');

  return new NextResponse(new Uint8Array(fichier.contenu), {
    status: 200,
    headers: {
      'Content-Type': fichier.typeMime,
      'Content-Disposition': `attachment; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(fichier.nomFichier)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
