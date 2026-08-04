import 'server-only';
import QRCode from 'qrcode';
import type { Modalite } from '@prisma/client';
import { formaterDateLongue, formaterHeure } from '../dates';

/**
 * Options communes à l'aperçu et aux deux téléchargements (lot 4, étape 9,
 * section G) : correction d'erreur élevée et marge de 4 modules (la "quiet
 * zone" minimale de la norme QR) pour rester scannable même dégradé —
 * projeté au fond d'une salle, imprimé petit, sur un écran de mauvaise
 * qualité. Noir pur sur blanc pur : contraste maximal.
 */
const OPTIONS_QR = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
  color: { dark: '#000000', light: '#ffffff' },
};

const TAILLE_APERCU = 200;
const TAILLE_TELECHARGEMENT = 1024;

export function construireLienPublicSeminaire(origine: string, codePublic: string): string {
  return `${origine}/s/${codePublic}`;
}

// Petit format, intégré directement dans la fiche séminaire (pas de
// téléchargement) — mêmes réglages ECC/marge/contraste que les
// téléchargements pour rester cohérent visuellement.
export async function genererApercuQrSvg(lien: string): Promise<string> {
  return QRCode.toString(lien, { ...OPTIONS_QR, type: 'svg', width: TAILLE_APERCU });
}

export async function genererQrPng(lien: string): Promise<Buffer> {
  return QRCode.toBuffer(lien, { ...OPTIONS_QR, type: 'png', width: TAILLE_TELECHARGEMENT });
}

export async function genererQrSvg(lien: string): Promise<string> {
  return QRCode.toString(lien, { ...OPTIONS_QR, type: 'svg', width: TAILLE_TELECHARGEMENT });
}

interface SeminairePourInvitation {
  titre: string;
  dateDebut: Date;
  lieu: string | null;
  modalite: Modalite;
}

/**
 * Texte prêt à copier pour une invitation par e-mail ou WhatsApp — assez
 * neutre dans les deux cas pour ne pas nécessiter deux versions distinctes.
 * Pure (aucun accès DB) : testable sans base, même logique que
 * formulaire-seminaire.ts.
 */
export function genererTexteInvitation(seminaire: SeminairePourInvitation, lien: string): string {
  const lieu = seminaire.modalite === 'DISTANCIEL' ? 'en ligne' : seminaire.lieu;
  const lieuTexte = lieu ? ` (${lieu})` : '';

  return [
    `Vous êtes invité·e au séminaire « ${seminaire.titre} », le ${formaterDateLongue(seminaire.dateDebut)} à ${formaterHeure(seminaire.dateDebut)}${lieuTexte}.`,
    `Inscrivez-vous ici : ${lien}`,
  ].join('\n\n');
}
