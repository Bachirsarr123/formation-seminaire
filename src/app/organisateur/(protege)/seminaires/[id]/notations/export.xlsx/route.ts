import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirNotationsSeminaire } from '@/lib/organisateur/notations';
import { LIBELLE_TYPE_NOTATION } from '@/lib/libelles';

// Même accès et même contenu que export.csv/route.ts, au format Excel —
// généré à la demande à chaque téléchargement, jamais mis en cache.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const vue = await obtenirNotationsSeminaire(contexte.cabinetId, id, contexte);
  if (!vue) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Notations');
  feuille.columns = [
    { header: 'Nom', key: 'nom', width: 20 },
    { header: 'Prénom', key: 'prenom', width: 20 },
    { header: 'Type de notation', key: 'type', width: 18 },
    { header: 'Valeur', key: 'valeur', width: 10 },
    { header: 'Barème', key: 'bareme', width: 10 },
    { header: 'Justification', key: 'justification', width: 50 },
  ];

  for (const ligne of vue.lignes) {
    if (!ligne.notation) continue;
    feuille.addRow({
      nom: ligne.participant.nom,
      prenom: ligne.participant.prenom,
      type: LIBELLE_TYPE_NOTATION[ligne.notation.typeNotation],
      valeur: ligne.notation.valeur ?? '',
      bareme: ligne.notation.bareme ?? '',
      justification: ligne.notation.justification,
    });
  }

  const tampon = await classeur.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(tampon), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="notations-${seminaire.codePublic}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
