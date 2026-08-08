import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirRecueil } from '@/lib/organisateur/recueil';
import { libellesReponseRecueil } from '@/lib/recueil/options';
import { formaterDateCourte } from '@/lib/dates';

// Réservée aux organisateurs, comme le reste de l'écran recueil — généré à
// la demande à chaque téléchargement (jamais mis en cache), donc toujours à
// jour sans job ni fichier stocké.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const recueil = await obtenirRecueil(contexte.cabinetId, id);
  if (!recueil) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const classeur = new ExcelJS.Workbook();

  const feuilleParticipants = classeur.addWorksheet('Participants');
  feuilleParticipants.columns = [
    { header: 'Nom', key: 'nom', width: 20 },
    { header: 'Prénom', key: 'prenom', width: 20 },
    { header: 'Fonction', key: 'fonction', width: 25 },
    { header: 'Organisation', key: 'organisation', width: 25 },
    { header: "Date d'envoi", key: 'date', width: 15 },
  ];
  for (const reponse of recueil.reponses) {
    feuilleParticipants.addRow({
      nom: reponse.nom,
      prenom: reponse.prenom,
      fonction: reponse.fonction ?? '',
      organisation: reponse.organisation ?? '',
      date: formaterDateCourte(reponse.createdAt),
    });
  }

  const feuilleReponses = classeur.addWorksheet('Réponses');
  feuilleReponses.columns = [
    { header: 'Nom', key: 'nom', width: 20 },
    { header: 'Prénom', key: 'prenom', width: 20 },
    ...recueil.questions.map((question, index) => ({ header: question.intitule, key: `q${index}`, width: 30 })),
  ];
  for (const reponse of recueil.reponses) {
    const brut = (reponse.reponses ?? {}) as Record<string, string | string[]>;
    const ligne: Record<string, string> = { nom: reponse.nom, prenom: reponse.prenom };
    recueil.questions.forEach((question, index) => {
      ligne[`q${index}`] = libellesReponseRecueil(question, brut[question.id]).join('; ');
    });
    feuilleReponses.addRow(ligne);
  }

  const tampon = await classeur.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(tampon), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="recueil-${seminaire.codePublic}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
