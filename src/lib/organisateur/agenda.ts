import 'server-only';
import { randomBytes } from 'node:crypto';
import { StatutSeminaire } from '@prisma/client';
import { prisma } from '../prisma';
import { genererIcsMultiple } from '../calendrier-ics';

export interface SeminaireAgenda {
  id: string;
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  statut: StatutSeminaire;
}

/**
 * Séminaires chevauchant le mois donné (mois : 1-12), pour la vue agenda —
 * une grille CSS, pas un moteur de calendrier (lot 4, section D). `cabinetId`
 * obligatoire, appliqué en clause WHERE (règle B).
 */
export async function listerSeminairesAgenda(
  cabinetId: string,
  { annee, mois }: { annee: number; mois: number },
  filtres: { formateurId?: string } = {},
): Promise<SeminaireAgenda[]> {
  const debutMois = new Date(Date.UTC(annee, mois - 1, 1));
  const finMois = new Date(Date.UTC(annee, mois, 1));

  return prisma.seminaire.findMany({
    where: {
      cabinetId,
      supprimeLe: null,
      dateDebut: { lt: finMois },
      dateFin: { gte: debutMois },
      ...(filtres.formateurId
        ? { formateurs: { some: { utilisateurId: filtres.formateurId } } }
        : {}),
    },
    select: { id: true, titre: true, dateDebut: true, dateFin: true, statut: true },
    orderBy: { dateDebut: 'asc' },
  });
}

// Exclut BROUILLON (pas encore confirmé) et ARCHIVE (mis de côté,
// volontairement hors du flux courant) : un abonnement agenda montre ce qui
// est actif, pas tout l'historique depuis toujours.
const STATUTS_FLUX_ICS: StatutSeminaire[] = [
  StatutSeminaire.PUBLIE,
  StatutSeminaire.EN_COURS,
  StatutSeminaire.CLOTURE,
];

/**
 * Contenu du flux : titre, dates, lieu — jamais les inscrits, le taux de
 * réponse ni codePublic (l'URL du flux elle-même est un secret de longue
 * durée, inutile d'y ajouter un lien vers la page publique en plus).
 */
export async function genererFluxIcsCabinet(cabinetId: string): Promise<string> {
  const seminaires = await prisma.seminaire.findMany({
    where: { cabinetId, supprimeLe: null, statut: { in: STATUTS_FLUX_ICS } },
    select: { id: true, titre: true, lieu: true, dateDebut: true, dateFin: true },
    orderBy: { dateDebut: 'asc' },
  });

  return genererIcsMultiple(
    seminaires.map((s) => ({
      uid: `seminaire-${s.id}@plateforme-seminaires`,
      titre: s.titre,
      lieu: s.lieu,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
    })),
  );
}

function genererJetonFlux(): string {
  return randomBytes(24).toString('base64url');
}

export async function obtenirOuGenererJetonFluxIcs(cabinetId: string): Promise<string> {
  const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId }, select: { jetonFluxIcs: true } });
  if (cabinet.jetonFluxIcs) return cabinet.jetonFluxIcs;

  const jeton = genererJetonFlux();
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { jetonFluxIcs: jeton } });
  return jeton;
}

/**
 * Révocation : régénère un jeton neuf, l'ancien cesse instantanément de
 * fonctionner (un abonnement déjà configuré dans Outlook/Google devra être
 * reconfiguré) — action explicite depuis un bouton visible, pas seulement
 * une fonction de lib (lot 4, point de vigilance sur le flux ICS).
 */
export async function regenererJetonFluxIcs(cabinetId: string): Promise<string> {
  const jeton = genererJetonFlux();
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { jetonFluxIcs: jeton } });
  return jeton;
}

/**
 * Résout le cabinet propriétaire d'un jeton de flux — c'est le jeton lui-même
 * qui authentifie cette requête (aucune session, un client de messagerie ne
 * porte pas de cookie), jamais un identifiant de cabinet fourni en clair.
 */
export async function resoudreCabinetParJetonFluxIcs(jeton: string): Promise<{ cabinetId: string } | null> {
  if (!jeton) return null;
  const cabinet = await prisma.cabinet.findUnique({ where: { jetonFluxIcs: jeton }, select: { id: true } });
  return cabinet ? { cabinetId: cabinet.id } : null;
}
