import 'server-only';
import { prisma } from './prisma';
import { lireFichierSupportOuNull } from './organisateur/stockage-supports';
import type { FichierSupport } from './organisateur/supports';

export interface SupportVisible {
  id: string;
  titre: string;
  nomFichier: string;
  tailleFichier: number;
  typeMime: string;
}

// Aucun paramètre d'identité (participant/inscription) : uniquement le
// séminaire déjà résolu par le jeton (resoudreContexteParticipant) — un
// support n'est jamais scopé par qui le télécharge, seulement par
// visibleParticipants.
export async function listerSupportsVisibles(seminaireId: string): Promise<SupportVisible[]> {
  return prisma.supportCours.findMany({
    where: { seminaireId, visibleParticipants: true, supprimeLe: null },
    select: { id: true, titre: true, nomFichier: true, tailleFichier: true, typeMime: true },
    orderBy: { ordre: 'asc' },
  });
}

/**
 * `seminaireId` vient du contexte participant déjà résolu (jeton), jamais
 * du client directement — un participant ne peut donc jamais atteindre le
 * support d'un AUTRE séminaire en devinant un supportId, même s'il connaît
 * un id valide ailleurs : la clause `seminaireId` ci-dessous l'exclurait.
 * `visibleParticipants: true` exclut aussi tout support marqué non visible,
 * même téléchargé directement par son id.
 */
export async function obtenirFichierSupportVisible(seminaireId: string, supportId: string): Promise<FichierSupport | null> {
  const support = await prisma.supportCours.findFirst({
    where: { id: supportId, seminaireId, visibleParticipants: true, supprimeLe: null },
    select: { nomFichier: true, typeMime: true, urlStockage: true },
  });
  if (!support) return null;

  const fichier = await lireFichierSupportOuNull(support.urlStockage);
  if (!fichier) return null;
  return { nomFichier: support.nomFichier, typeMime: support.typeMime, contenu: fichier.contenu };
}
