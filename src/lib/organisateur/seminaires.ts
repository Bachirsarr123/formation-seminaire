import 'server-only';
import { Modalite, Prisma, RoleFormateur, StatutSeminaire } from '@prisma/client';
import { prisma } from '../prisma';
import { genererCodePublicSeminaire } from '../jeton';

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

// ============================================================
// Fiche, création, édition, cycle de vie, duplication (lot 4, section E).
// Toute fonction ci-dessous prend cabinetId en paramètre obligatoire et
// l'applique en clause WHERE (règle B) — une ressource d'un autre cabinet
// n'est jamais atteinte, jamais distinguable d'une ressource inexistante :
// les fonctions renvoient `null`, à l'appelant de traduire ça en 404 (jamais
// un 403, qui confirmerait l'existence de la ressource dans un autre cabinet).
// ============================================================

export class CapaciteInferieureAuxInscritsError extends Error {
  constructor(
    public readonly inscrits: number,
    public readonly capaciteDemandee: number,
  ) {
    super(
      `La capacité demandée (${capaciteDemandee}) est inférieure au nombre de personnes déjà inscrites (${inscrits}).`,
    );
    this.name = 'CapaciteInferieureAuxInscritsError';
  }
}

const ORDRE_STATUT: Record<StatutSeminaire, number> = {
  BROUILLON: 0,
  PUBLIE: 1,
  EN_COURS: 2,
  CLOTURE: 3,
  ARCHIVE: 4,
};

export class TransitionStatutInvalideError extends Error {
  constructor(
    public readonly statutActuel: StatutSeminaire,
    public readonly statutCible: StatutSeminaire,
  ) {
    super(
      `Impossible de repasser de ${statutActuel} à ${statutCible} : les transitions arrière sont interdites au-delà de EN_COURS.`,
    );
    this.name = 'TransitionStatutInvalideError';
  }
}

export class FormateurEtrangerError extends Error {
  constructor() {
    super("Un des formateurs sélectionnés n'appartient pas à ce cabinet.");
    this.name = 'FormateurEtrangerError';
  }
}

export interface ModuleDonnees {
  titre: string;
  description?: string | null;
  dureeMinutes: number;
  ordre: number;
}

export interface FormateurAffecte {
  utilisateurId: string;
  roleFormateur: RoleFormateur;
}

export interface DonneesSeminaire {
  titre: string;
  description?: string | null;
  dateDebut: Date;
  dateFin: Date;
  lieu?: string | null;
  modalite: Modalite;
  dureeHeures: number;
  capaciteMax?: number | null;
  inscriptionOuverte: boolean;
  validationRequise: boolean;
  seuilAnonymat: number;
  formateurs: FormateurAffecte[];
  modules: ModuleDonnees[];
}

async function compterInscrits(seminaireId: string): Promise<number> {
  return prisma.inscription.count({
    where: { seminaireId, statut: { in: ['CONFIRMEE', 'EN_ATTENTE'] } },
  });
}

async function verifierFormateursDuCabinet(cabinetId: string, formateurs: FormateurAffecte[]): Promise<void> {
  if (formateurs.length === 0) return;
  const ids = formateurs.map((f) => f.utilisateurId);
  const nb = await prisma.utilisateur.count({ where: { id: { in: ids }, cabinetId, role: 'FORMATEUR' } });
  if (nb !== new Set(ids).size) throw new FormateurEtrangerError();
}

export async function obtenirSeminaire(cabinetId: string, seminaireId: string) {
  return prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    include: {
      modules: { orderBy: { ordre: 'asc' } },
      formateurs: { include: { utilisateur: { select: { id: true, nom: true, prenom: true } } } },
    },
  });
}

export async function creerSeminaire(cabinetId: string, donnees: DonneesSeminaire) {
  await verifierFormateursDuCabinet(cabinetId, donnees.formateurs);

  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: donnees.titre,
      description: donnees.description,
      dateDebut: donnees.dateDebut,
      dateFin: donnees.dateFin,
      lieu: donnees.lieu,
      modalite: donnees.modalite,
      dureeHeures: donnees.dureeHeures,
      capaciteMax: donnees.capaciteMax,
      inscriptionOuverte: donnees.inscriptionOuverte,
      validationRequise: donnees.validationRequise,
      seuilAnonymat: donnees.seuilAnonymat,
      statut: StatutSeminaire.BROUILLON,
      modules: { create: donnees.modules },
      formateurs: { create: donnees.formateurs },
    },
  });
}

/**
 * Modules et formateurs sont entièrement remplacés à chaque édition (pas de
 * fusion différentielle) : plus simple, et sans effet observable pour ce
 * lot — aucune donnée ne référence encore un module par son id (l'éditeur de
 * questionnaire, qui le fera, vient dans un lot dédié).
 */
export async function modifierSeminaire(cabinetId: string, seminaireId: string, donnees: DonneesSeminaire) {
  const existant = await prisma.seminaire.findFirst({ where: { id: seminaireId, cabinetId, supprimeLe: null } });
  if (!existant) return null;

  if (donnees.capaciteMax !== null && donnees.capaciteMax !== undefined) {
    const inscrits = await compterInscrits(seminaireId);
    if (donnees.capaciteMax < inscrits) {
      throw new CapaciteInferieureAuxInscritsError(inscrits, donnees.capaciteMax);
    }
  }

  await verifierFormateursDuCabinet(cabinetId, donnees.formateurs);

  return prisma.$transaction(async (tx) => {
    await tx.module.deleteMany({ where: { seminaireId } });
    await tx.seminaireFormateur.deleteMany({ where: { seminaireId } });

    return tx.seminaire.update({
      where: { id: seminaireId },
      data: {
        titre: donnees.titre,
        description: donnees.description,
        dateDebut: donnees.dateDebut,
        dateFin: donnees.dateFin,
        lieu: donnees.lieu,
        modalite: donnees.modalite,
        dureeHeures: donnees.dureeHeures,
        capaciteMax: donnees.capaciteMax,
        inscriptionOuverte: donnees.inscriptionOuverte,
        validationRequise: donnees.validationRequise,
        seuilAnonymat: donnees.seuilAnonymat,
        modules: { create: donnees.modules },
        formateurs: { create: donnees.formateurs },
      },
    });
  });
}

export async function changerStatutSeminaire(
  cabinetId: string,
  seminaireId: string,
  statutCible: StatutSeminaire,
) {
  const seminaire = await prisma.seminaire.findFirst({ where: { id: seminaireId, cabinetId, supprimeLe: null } });
  if (!seminaire) return null;
  if (seminaire.statut === statutCible) return seminaire;

  const actuel = ORDRE_STATUT[seminaire.statut];
  const cible = ORDRE_STATUT[statutCible];

  if (cible < actuel && actuel >= ORDRE_STATUT.EN_COURS) {
    throw new TransitionStatutInvalideError(seminaire.statut, statutCible);
  }

  return prisma.seminaire.update({ where: { id: seminaireId }, data: { statut: statutCible } });
}

/**
 * Suppression logique uniquement (supprimeLe) — jamais physique : les
 * inscriptions/questionnaires qui en dépendent restent auditables. Renvoie
 * `false` si la ressource n'existe pas ou appartient à un autre cabinet,
 * pour que l'appelant réponde 404 dans les deux cas indifféremment.
 */
export async function supprimerSeminaireLogiquement(cabinetId: string, seminaireId: string): Promise<boolean> {
  const resultat = await prisma.seminaire.updateMany({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    data: { supprimeLe: new Date() },
  });
  return resultat.count > 0;
}

/**
 * Duplique la structure (champs, modules, formateurs) — jamais les
 * participants ni les réponses, qui n'existent d'ailleurs pas au niveau
 * Seminaire (Règle 2 : elles ne remontent que jusqu'à Questionnaire). Le
 * questionnaire lui-même n'est pas dupliqué ici : son cycle (modèles, copie)
 * relève du lot questionnaire, pas de celui-ci. codePublic regénéré, statut
 * réinitialisé à BROUILLON, inscriptions fermées par défaut — l'organisateur
 * ajuste les dates et republie quand la copie est prête.
 */
export async function dupliquerSeminaire(cabinetId: string, seminaireId: string) {
  const original = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    include: { modules: { orderBy: { ordre: 'asc' } }, formateurs: true },
  });
  if (!original) return null;

  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: `${original.titre} (copie)`,
      description: original.description,
      dateDebut: original.dateDebut,
      dateFin: original.dateFin,
      lieu: original.lieu,
      modalite: original.modalite,
      dureeHeures: original.dureeHeures,
      capaciteMax: original.capaciteMax,
      statut: StatutSeminaire.BROUILLON,
      inscriptionOuverte: false,
      validationRequise: original.validationRequise,
      seuilAnonymat: original.seuilAnonymat,
      modules: {
        create: original.modules.map((m) => ({
          titre: m.titre,
          description: m.description,
          dureeMinutes: m.dureeMinutes,
          ordre: m.ordre,
        })),
      },
      formateurs: {
        create: original.formateurs.map((f) => ({
          utilisateurId: f.utilisateurId,
          roleFormateur: f.roleFormateur,
        })),
      },
    },
  });
}
