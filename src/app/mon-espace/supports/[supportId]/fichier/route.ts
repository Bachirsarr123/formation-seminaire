import { NextResponse } from 'next/server';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { obtenirFichierSupportVisible } from '@/lib/supports-participant';

// Aucune authentification autre que le cookie de session participant (même
// garde que le reste de /mon-espace) — obtenirFichierSupportVisible revérifie
// que le support appartient bien AU SÉMINAIRE de ce contexte et reste
// visibleParticipants, jamais un id de support pris isolément.
export async function GET(_request: Request, { params }: { params: Promise<{ supportId: string }> }) {
  const { supportId } = await params;

  const jeton = await lireJetonSession();
  if (!jeton) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }
  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const fichier = await obtenirFichierSupportVisible(contexte.seminaire.id, supportId);
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
