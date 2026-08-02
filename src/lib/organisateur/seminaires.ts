import 'server-only';
import { Prisma, StatutSeminaire } from '@prisma/client';
import { prisma } from '../prisma';

export interface FiltresSeminaires {
  statut?: StatutSeminaire;
  periode?: 'AVENIR' | 'PASSE';
  formateurId?: string;
  recherche?: string;
}

export interface PaginationParams {
  page: number;
  parPage?: number;
}

export interface SeminaireListe {
  id: string;
  codePublic: string;
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  lieu: string | null;
  statut: StatutSeminaire;
  capaciteMax: number | null;
  inscrits: number;
  tauxReponse: number | null;
}

interface LigneSeminaireListe {
  id: string;
  code_public: string;
  titre: string;
  date_debut: Date;
  date_fin: Date;
  lieu: string | null;
  statut: StatutSeminaire;
  capacite_max: number | null;
  inscrits: bigint;
  confirmes: bigint;
  repondu: bigint;
}

function construireConditions(cabinetId: string, filtres: FiltresSeminaires): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`s.cabinet_id = ${cabinetId}`, Prisma.sql`s.supprime_le IS NULL`];

  if (filtres.statut) conditions.push(Prisma.sql`s.statut = ${filtres.statut}::statut_seminaire`);
  if (filtres.periode === 'AVENIR') conditions.push(Prisma.sql`s.date_fin >= now()`);
  if (filtres.periode === 'PASSE') conditions.push(Prisma.sql`s.date_fin < now()`);
  if (filtres.recherche?.trim()) conditions.push(Prisma.sql`s.titre ILIKE ${'%' + filtres.recherche.trim() + '%'}`);
  if (filtres.formateurId) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM seminaire_formateur sf WHERE sf.seminaire_id = s.id AND sf.utilisateur_id = ${filtres.formateurId})`,
    );
  }

  return conditions;
}

/**
 * Vue « liste » — la plus utile au quotidien (lot 4, section D). Tri : les
 * séminaires à venir (date_fin >= maintenant) d'abord, du plus proche au
 * plus lointain ; les séminaires passés ensuite, du plus récemment conclu au
 * plus ancien — le dernier séminaire terminé (taux de réponse encore
 * incomplet, probablement à surveiller) est plus utile en haut de liste
 * qu'un événement d'il y a un an. D'où les deux CASE : la première colonne
 * partitionne (à venir avant passés), les deux suivantes n'appliquent
 * chacune leur tri qu'à l'intérieur de leur partition (NULL dans l'autre).
 *
 * `cabinetId` est un paramètre obligatoire, jamais déduit d'autre chose que
 * la session résolue par l'appelant (règle B du lot) — appliqué ici en
 * clause WHERE, jamais contournable.
 */
export async function listerSeminaires(
  cabinetId: string,
  filtres: FiltresSeminaires = {},
  { page, parPage = 20 }: PaginationParams,
): Promise<{ items: SeminaireListe[]; total: number }> {
  const conditions = construireConditions(cabinetId, filtres);
  const where = Prisma.join(conditions, ' AND ');
  const offset = Math.max(0, (page - 1) * parPage);

  const [lignes, totalLignes] = await Promise.all([
    prisma.$queryRaw<LigneSeminaireListe[]>(Prisma.sql`
      SELECT
        s.id, s.code_public, s.titre, s.date_debut, s.date_fin, s.lieu, s.statut, s.capacite_max,
        (SELECT COUNT(*) FROM inscription i WHERE i.seminaire_id = s.id AND i.statut IN ('CONFIRMEE', 'EN_ATTENTE')) AS inscrits,
        (SELECT COUNT(*) FROM inscription i WHERE i.seminaire_id = s.id AND i.statut = 'CONFIRMEE') AS confirmes,
        (SELECT COUNT(*) FROM inscription i WHERE i.seminaire_id = s.id AND i.statut = 'CONFIRMEE' AND i.a_repondu = true) AS repondu
      FROM seminaire s
      WHERE ${where}
      ORDER BY
        (s.date_fin < now()),
        CASE WHEN s.date_fin >= now() THEN s.date_debut END ASC,
        CASE WHEN s.date_fin < now() THEN s.date_debut END DESC
      LIMIT ${parPage} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM seminaire s WHERE ${where}`),
  ]);

  return {
    items: lignes.map((ligne) => ({
      id: ligne.id,
      codePublic: ligne.code_public,
      titre: ligne.titre,
      dateDebut: ligne.date_debut,
      dateFin: ligne.date_fin,
      lieu: ligne.lieu,
      statut: ligne.statut,
      capaciteMax: ligne.capacite_max,
      inscrits: Number(ligne.inscrits),
      tauxReponse: Number(ligne.confirmes) > 0 ? Number(ligne.repondu) / Number(ligne.confirmes) : null,
    })),
    total: Number(totalLignes[0]?.total ?? 0),
  };
}
