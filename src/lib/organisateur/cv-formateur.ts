import 'server-only';
import { prisma } from '../prisma';
import { enregistrerFichierSupport, lireFichierSupport } from './stockage-supports';

// CV formateur (Utilisateur.cvUrl) — même adaptateur de stockage local que
// les supports de cours et le logo client, dossier propre au compte
// (utilisateurId, jamais seminaireId : un CV n'est pas rattaché à un
// séminaire précis, seulement à la personne).

export const PLAFOND_TAILLE_CV_OCTETS = 5 * 1024 * 1024; // 5 Mo

/** `null` si le fichier est valide, sinon le message d'erreur à renvoyer tel quel. */
export function erreurCvInvalide(typeMime: string, tailleOctets: number): string | null {
  if (typeMime !== 'application/pdf') return 'Le CV doit être un fichier PDF.';
  if (tailleOctets > PLAFOND_TAILLE_CV_OCTETS) {
    return `Le CV dépasse la taille maximale autorisée (${PLAFOND_TAILLE_CV_OCTETS / (1024 * 1024)} Mo).`;
  }
  return null;
}

/** `false` si le compte n'existe pas, appartient à un autre cabinet, ou n'est pas un formateur (règle B). */
export async function enregistrerCvFormateur(
  cabinetId: string,
  utilisateurId: string,
  nomFichier: string,
  contenu: Buffer,
): Promise<boolean> {
  const formateur = await prisma.utilisateur.findFirst({
    where: { id: utilisateurId, cabinetId, role: 'FORMATEUR' },
    select: { id: true },
  });
  if (!formateur) return false;

  const urlStockage = await enregistrerFichierSupport(utilisateurId, nomFichier, contenu);
  await prisma.utilisateur.update({ where: { id: utilisateurId }, data: { cvUrl: urlStockage } });
  return true;
}

export interface FichierCv {
  nomFichier: string;
  contenu: Buffer;
}

/**
 * Pas de colonne dédiée au nom de fichier original (un seul champ
 * `cvUrl` en base, chemin de stockage) : le nom présenté au téléchargement
 * est dérivé de l'identité du formateur, pas du nom de fichier fourni par
 * l'organisateur au moment de l'upload.
 */
export async function obtenirFichierCv(utilisateurId: string): Promise<FichierCv | null> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { cvUrl: true, nom: true, prenom: true },
  });
  if (!utilisateur?.cvUrl) return null;

  const contenu = await lireFichierSupport(utilisateur.cvUrl);
  return { nomFichier: `CV - ${utilisateur.prenom} ${utilisateur.nom}.pdf`, contenu };
}
