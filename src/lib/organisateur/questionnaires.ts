import 'server-only';
import { Prisma, StatutQuestionnaire, type Questionnaire } from '@prisma/client';
import { prisma } from '../prisma';

// ============================================================
// Bibliothèque de modèles du cabinet (lot 5, partie A). Même règle B que
// seminaires.ts/equipe.ts : cabinetId obligatoire partout, appliqué en
// clause WHERE.
// ============================================================

export interface DonneesModele {
  nom: string;
  titre: string;
}

export interface ModeleListe {
  id: string;
  nom: string | null;
  titre: string;
  nbQuestions: number;
  nbSeminaires: number;
}

/**
 * Liste les modèles actifs du cabinet (archivage = `supprimeLe`, même
 * logique que toute suppression logique de ce schéma — pas de nouvel enum).
 * `nbSeminaires` est un COMPTE DISTINCT de `seminaireId` parmi les
 * questionnaires non-modèles qui en descendent : un séminaire peut porter
 * plusieurs questionnaires issus du même modèle (dupliquerQuestionnaire
 * après verrouillage reporte le même modeleOrigineId), il ne doit compter
 * qu'une fois — d'où une requête brute plutôt qu'un `groupBy` Prisma, qui ne
 * sait pas exprimer un COUNT(DISTINCT ...).
 */
export async function listerModeles(cabinetId: string): Promise<ModeleListe[]> {
  const modeles = await prisma.questionnaire.findMany({
    where: { cabinetId, estModele: true, supprimeLe: null },
    select: {
      id: true,
      nom: true,
      titre: true,
      sections: { select: { questions: { where: { supprimeLe: null }, select: { id: true } } } },
    },
    orderBy: { nom: 'asc' },
  });

  if (modeles.length === 0) return [];

  const comptes = await prisma.$queryRaw<{ modele_origine_id: string; total: bigint }[]>(Prisma.sql`
    SELECT modele_origine_id, COUNT(DISTINCT seminaire_id) AS total
    FROM questionnaire
    WHERE cabinet_id = ${cabinetId}
      AND est_modele = false
      AND supprime_le IS NULL
      AND modele_origine_id IN (${Prisma.join(modeles.map((m) => m.id))})
    GROUP BY modele_origine_id
  `);
  const comptesParModele = new Map(comptes.map((c) => [c.modele_origine_id, Number(c.total)]));

  return modeles.map((m) => ({
    id: m.id,
    nom: m.nom,
    titre: m.titre,
    nbQuestions: m.sections.reduce((total, s) => total + s.questions.length, 0),
    nbSeminaires: comptesParModele.get(m.id) ?? 0,
  }));
}

export async function creerModele(cabinetId: string, donnees: DonneesModele): Promise<Questionnaire> {
  return prisma.questionnaire.create({
    data: {
      cabinetId,
      estModele: true,
      nom: donnees.nom,
      titre: donnees.titre,
      statut: StatutQuestionnaire.BROUILLON,
    },
  });
}

/**
 * Archivage = suppression logique (`supprimeLe`), jamais physique : les
 * séminaires qui en descendent gardent leur historique. `false` si le modèle
 * n'existe pas ou appartient à un autre cabinet (règle B — 404 à l'appelant).
 */
export async function archiverModele(cabinetId: string, modeleId: string): Promise<boolean> {
  const resultat = await prisma.questionnaire.updateMany({
    where: { id: modeleId, cabinetId, estModele: true, supprimeLe: null },
    data: { supprimeLe: new Date() },
  });
  return resultat.count > 0;
}

export interface QuestionnaireDuSeminaire {
  id: string;
  titre: string;
  statut: StatutQuestionnaire;
}

/**
 * Le questionnaire « actif » d'un séminaire, pour la fiche séminaire (lien
 * direct) et la future page de résultats. Un séminaire peut porter plusieurs
 * questionnaires au fil du temps (dupliquerQuestionnaire après verrouillage
 * en crée un nouveau, rattaché au même séminaire) : le plus récent non
 * archivé est celui qui compte — c'est celui que les participants voient
 * réellement (mon-espace/questionnaire/page.tsx cible aussi le plus
 * pertinent par statut PUBLIE, jamais par ancienneté d'insertion).
 */
export async function obtenirQuestionnaireActifDuSeminaire(
  cabinetId: string,
  seminaireId: string,
): Promise<QuestionnaireDuSeminaire | null> {
  return prisma.questionnaire.findFirst({
    where: { cabinetId, seminaireId, supprimeLe: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, titre: true, statut: true },
  });
}
