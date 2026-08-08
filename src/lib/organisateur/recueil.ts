import 'server-only';
import type { TypeRecueilQuestion } from '@prisma/client';
import { prisma } from '../prisma';
import { genererCodeAccesRecueil, genererCodeConsultationRecueil } from '../jeton';

/**
 * Toute fonction ci-dessous prend cabinetId en paramètre obligatoire et
 * l'applique en clause WHERE (même règle B que lib/organisateur/seminaires.ts)
 * — une ressource d'un autre cabinet n'est jamais atteinte, jamais
 * distinguable d'une ressource inexistante.
 */

// Seul endroit de l'application qui charge les réponses ET l'identité de
// qui les a données (nom/prénom/fonction/organisation) dans une même
// requête — la consultation formateur (lib/recueil/consultation.ts) exclut
// volontairement ces colonnes au niveau du `select`, pas seulement à
// l'affichage.
export async function obtenirRecueil(cabinetId: string, seminaireId: string) {
  return prisma.recueil.findFirst({
    where: { seminaireId, cabinetId },
    include: {
      questions: { orderBy: { ordre: 'asc' } },
      reponses: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export interface DonneesRecueil {
  titre: string;
  description: string;
}

/**
 * Un seul recueil par séminaire (contrainte @unique sur seminaireId) : appelé
 * uniquement depuis l'écran qui vérifie déjà qu'aucun recueil n'existe encore
 * pour ce séminaire, mais la contrainte base reste le filet de sécurité
 * final contre une double création (double clic, deux onglets).
 */
export async function creerRecueil(cabinetId: string, seminaireId: string, donnees: DonneesRecueil) {
  const seminaire = await prisma.seminaire.findFirst({ where: { id: seminaireId, cabinetId, supprimeLe: null } });
  if (!seminaire) return null;

  return prisma.recueil.create({
    data: {
      seminaireId,
      cabinetId,
      titre: donnees.titre,
      description: donnees.description,
      codeAcces: genererCodeAccesRecueil(),
      codeConsultation: genererCodeConsultationRecueil(),
    },
  });
}

export interface DonneesQuestionRecueil {
  intitule: string;
  type: TypeRecueilQuestion;
  options?: unknown;
}

export async function ajouterQuestionRecueil(cabinetId: string, recueilId: string, donnees: DonneesQuestionRecueil) {
  const recueil = await prisma.recueil.findFirst({ where: { id: recueilId, cabinetId } });
  if (!recueil) return null;

  const derniere = await prisma.recueilQuestion.findFirst({
    where: { recueilId },
    orderBy: { ordre: 'desc' },
    select: { ordre: true },
  });

  return prisma.recueilQuestion.create({
    data: {
      recueilId,
      intitule: donnees.intitule,
      type: donnees.type,
      options: donnees.options as never,
      ordre: (derniere?.ordre ?? 0) + 1,
    },
  });
}

/** Renvoie `false` si la question n'existe pas ou appartient à un autre cabinet. */
export async function supprimerQuestionRecueil(cabinetId: string, recueilId: string, questionId: string): Promise<boolean> {
  const recueil = await prisma.recueil.findFirst({ where: { id: recueilId, cabinetId }, select: { id: true } });
  if (!recueil) return false;

  const resultat = await prisma.recueilQuestion.deleteMany({ where: { id: questionId, recueilId } });
  return resultat.count > 0;
}
