import 'server-only';
import { prisma } from '../prisma';
import { enregistrerFichierSupport, lireFichierSupportOuNull } from './stockage-supports';
import type { Direction } from '../questionnaire/editeur';

// ============================================================
// Supports de cours (lot supports). Même règle B que le reste de
// lib/organisateur/ : cabinetId obligatoire partout, appliqué via
// seminaire.cabinetId (SupportCours n'a pas de colonne cabinetId propre,
// comme Module — voir schema.prisma).
// ============================================================

export const PLAFOND_TAILLE_SUPPORT_OCTETS = 10 * 1024 * 1024; // 10 Mo

// PDF, PPTX, DOCX, XLSX, images (contrainte du lot). Le format historique
// .doc/.ppt/.xls (application/msword etc.) est volontairement absent : la
// contrainte ne cite que les formats Office modernes.
export const TYPES_MIME_AUTORISES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export interface SupportListe {
  id: string;
  titre: string;
  nomFichier: string;
  tailleFichier: number;
  typeMime: string;
  visibleParticipants: boolean;
  ordre: number;
}

async function verifierAccesSeminaire(cabinetId: string, seminaireId: string): Promise<boolean> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  return seminaire !== null;
}

/** `null` si le séminaire n'existe pas ou appartient à un autre cabinet (règle B). */
export async function listerSupports(cabinetId: string, seminaireId: string): Promise<SupportListe[] | null> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return null;

  return prisma.supportCours.findMany({
    where: { seminaireId, supprimeLe: null },
    select: { id: true, titre: true, nomFichier: true, tailleFichier: true, typeMime: true, visibleParticipants: true, ordre: true },
    orderBy: { ordre: 'asc' },
  });
}

export type ResultatAjoutSupport = { ok: true } | { ok: false; erreur: string };

export interface DonneesNouveauSupport {
  titre: string;
  nomFichier: string;
  typeMime: string;
  contenu: Buffer;
}

/**
 * Écrit le fichier en base (stockage-supports.ts) UNIQUEMENT après avoir
 * validé taille et type — jamais de ligne orpheline pour une requête
 * finalement rejetée.
 */
export async function ajouterSupport(
  cabinetId: string,
  seminaireId: string,
  donnees: DonneesNouveauSupport,
): Promise<ResultatAjoutSupport> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return { ok: false, erreur: 'Séminaire introuvable.' };

  const titre = donnees.titre.trim();
  if (!titre) return { ok: false, erreur: 'Le titre est obligatoire.' };

  if (donnees.contenu.byteLength > PLAFOND_TAILLE_SUPPORT_OCTETS) {
    return { ok: false, erreur: `Le fichier dépasse la taille maximale autorisée (${PLAFOND_TAILLE_SUPPORT_OCTETS / (1024 * 1024)} Mo).` };
  }
  if (!(TYPES_MIME_AUTORISES as readonly string[]).includes(donnees.typeMime)) {
    return { ok: false, erreur: 'Type de fichier non autorisé (formats acceptés : PDF, PPTX, DOCX, XLSX, images).' };
  }

  const derniere = await prisma.supportCours.findFirst({
    where: { seminaireId, supprimeLe: null },
    orderBy: { ordre: 'desc' },
    select: { ordre: true },
  });

  const urlStockage = await enregistrerFichierSupport(donnees.typeMime, donnees.contenu);

  await prisma.supportCours.create({
    data: {
      seminaireId,
      titre,
      nomFichier: donnees.nomFichier,
      tailleFichier: donnees.contenu.byteLength,
      typeMime: donnees.typeMime,
      urlStockage,
      ordre: (derniere?.ordre ?? 0) + 1,
    },
  });

  return { ok: true };
}

/** Suppression LOGIQUE (`supprimeLe`) — jamais physique, ni la ligne SupportCours ni le FichierStocke qu'elle référence (voir schema.prisma). */
export async function supprimerSupportLogiquement(cabinetId: string, seminaireId: string, supportId: string): Promise<boolean> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return false;

  const resultat = await prisma.supportCours.updateMany({
    where: { id: supportId, seminaireId, supprimeLe: null },
    data: { supprimeLe: new Date() },
  });
  return resultat.count > 0;
}

export async function basculerVisibiliteSupport(
  cabinetId: string,
  seminaireId: string,
  supportId: string,
  visible: boolean,
): Promise<boolean> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return false;

  const resultat = await prisma.supportCours.updateMany({
    where: { id: supportId, seminaireId, supprimeLe: null },
    data: { visibleParticipants: visible },
  });
  return resultat.count > 0;
}

/** Même algorithme que deplacerQuestion/deplacerSection (lib/questionnaire/editeur.ts) : échange l'ordre avec le voisin immédiat. */
export async function deplacerSupport(
  cabinetId: string,
  seminaireId: string,
  supportId: string,
  direction: Direction,
): Promise<void> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return;

  const support = await prisma.supportCours.findFirst({ where: { id: supportId, seminaireId, supprimeLe: null } });
  if (!support) return;

  const voisin = await prisma.supportCours.findFirst({
    where: {
      seminaireId,
      supprimeLe: null,
      ordre: direction === 'HAUT' ? { lt: support.ordre } : { gt: support.ordre },
    },
    orderBy: { ordre: direction === 'HAUT' ? 'desc' : 'asc' },
  });
  if (!voisin) return;

  await prisma.$transaction([
    prisma.supportCours.update({ where: { id: support.id }, data: { ordre: voisin.ordre } }),
    prisma.supportCours.update({ where: { id: voisin.id }, data: { ordre: support.ordre } }),
  ]);
}

export interface FichierSupport {
  nomFichier: string;
  typeMime: string;
  contenu: Buffer;
}

/**
 * Téléchargement côté organisateur : aucune vérification de
 * `visibleParticipants` (l'organisateur voit tout ce qu'il a téléversé,
 * visible ou non) — seule l'appartenance au cabinet compte.
 *
 * `null` aussi bien si le support n'existe pas que si sa ligne référence un
 * fichier introuvable (cas hérité de l'ancien stockage disque, voir
 * lireFichierSupportOuNull) : les deux rendent la même réponse
 * « introuvable », jamais une erreur brute.
 */
export async function obtenirFichierSupportOrganisateur(
  cabinetId: string,
  seminaireId: string,
  supportId: string,
): Promise<FichierSupport | null> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return null;

  const support = await prisma.supportCours.findFirst({
    where: { id: supportId, seminaireId, supprimeLe: null },
    select: { nomFichier: true, typeMime: true, urlStockage: true },
  });
  if (!support) return null;

  const fichier = await lireFichierSupportOuNull(support.urlStockage);
  if (!fichier) return null;
  return { nomFichier: support.nomFichier, typeMime: support.typeMime, contenu: fichier.contenu };
}
