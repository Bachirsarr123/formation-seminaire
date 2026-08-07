import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

/**
 * Aucune authentification (contrainte du lot) : le code d'accès EST le
 * contrôle d'accès, comme le code public d'un séminaire. `actif` permet à
 * l'organisateur de fermer le formulaire sans supprimer le recueil ni casser
 * le lien de consultation, qui reste valable indépendamment.
 */
export async function chargerRecueilPublic(codeAcces: string) {
  const recueil = await prisma.recueil.findUnique({
    where: { codeAcces },
    include: {
      seminaire: { select: { titre: true } },
      cabinet: { select: { nom: true, adresse: true, emailContact: true, telephoneContact: true } },
      questions: { orderBy: { ordre: 'asc' } },
    },
  });

  if (!recueil || !recueil.actif) return null;
  return recueil;
}

export interface DonneesReponseRecueil {
  recueilId: string;
  nom: string;
  prenom: string;
  fonction: string | null;
  organisation: string | null;
  reponses: Record<string, string | string[]>;
}

// Pas de dédoublonnage (contrainte du lot) : chaque envoi est une ligne
// autonome, y compris deux envois de la même personne.
export async function soumettreReponseRecueil(donnees: DonneesReponseRecueil) {
  return prisma.recueilReponse.create({
    data: {
      recueilId: donnees.recueilId,
      nom: donnees.nom,
      prenom: donnees.prenom,
      fonction: donnees.fonction,
      organisation: donnees.organisation,
      reponses: donnees.reponses as Prisma.InputJsonValue,
    },
  });
}
