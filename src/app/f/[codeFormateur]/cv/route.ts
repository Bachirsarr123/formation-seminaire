import { NextResponse } from 'next/server';
import { resoudreContexteLienFormateur } from '@/lib/formateur-lien';
import { obtenirFichierCv } from '@/lib/organisateur/cv-formateur';

// Même principe d'accès que la page /f/{codeFormateur} elle-même (le code
// EST le seul contrôle d'accès, aucune session) — pas de distinction
// 403/404, un code inconnu ou périmé rend la même réponse générique qu'un CV
// absent.
export async function GET(_request: Request, { params }: { params: Promise<{ codeFormateur: string }> }) {
  const { codeFormateur } = await params;

  const contexte = await resoudreContexteLienFormateur(codeFormateur);
  if (!contexte) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const fichier = await obtenirFichierCv(contexte.utilisateurId);
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
