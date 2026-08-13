'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
import { envoyerRelanceQuestionnaire } from '@/lib/notification';
import { construireOrigineRequete } from '@/lib/origine-requete';

// Réservées aux organisateurs — le formateur a un accès lecture seule à cet
// écran (contrainte du lot). Message transactionnel (découle du rappel
// qu'un participant a déjà accepté en s'inscrivant), jamais conditionné au
// consentement COMMUNICATIONS — voir lib/notification.ts, qui distingue
// explicitement les deux familles.
//
// `jeton` est lu ici UNIQUEMENT pour être transmis à l'adaptateur de
// notification (lib/notification.ts), jamais renvoyé à l'appelant ni rendu
// dans une page organisateur — le jeton participant ne doit jamais transiter
// par l'espace organisateur (voir la même règle, déjà en place et testée,
// dans lib/organisateur/participants.ts/listerInscriptionsSeminaire).

async function relancer(cabinetId: string, seminaireId: string, participantId: string): Promise<boolean> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { titre: true },
  });
  if (!seminaire) return false;

  // Revérifié en base plutôt que de faire confiance aux valeurs affichées à
  // l'écran : seul un inscrit CONFIRMEE n'ayant pas répondu doit pouvoir
  // être relancé, quoi que l'appelant ait transmis.
  const inscription = await prisma.inscription.findFirst({
    where: { seminaireId, participantId, statut: 'CONFIRMEE', aRepondu: false },
    select: {
      jeton: true,
      participant: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
    },
  });
  if (!inscription) return false;

  const origine = construireOrigineRequete(await headers());

  await envoyerRelanceQuestionnaire(
    {
      participantId: inscription.participant.id,
      nom: inscription.participant.nom,
      prenom: inscription.participant.prenom,
      email: inscription.participant.email,
      telephone: inscription.participant.telephone,
    },
    seminaire.titre,
    `${origine}/p/${inscription.jeton}`,
  );
  return true;
}

export async function relancerNonRepondantAction(seminaireId: string, participantId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await relancer(contexte.cabinetId, seminaireId, participantId);
}

/**
 * Relance groupée depuis la fiche séminaire (section "Évaluation à chaud") :
 * même action que relancerNonRepondantAction, répétée pour chaque inscrit
 * CONFIRMEE n'ayant pas encore répondu au moment de l'appel. Revérifie
 * chaque participant individuellement (via `relancer`) plutôt que de faire
 * confiance à une liste chargée avant l'action — un participant qui vient
 * de répondre entre-temps n'est pas relancé pour rien.
 */
export async function relancerTousNonRepondantsAction(seminaireId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const nonRepondants = await prisma.inscription.findMany({
    where: { seminaireId, statut: 'CONFIRMEE', aRepondu: false, seminaire: { cabinetId: contexte.cabinetId } },
    select: { participantId: true },
  });

  // Séquentiel, pas Promise.all : le volume par séminaire reste borné (même
  // raisonnement que le tri en mémoire de listerInscriptionsSeminaire), et
  // ça évite de multiplier les connexions Prisma simultanées pour une action
  // déclenchée une fois de temps en temps, jamais dans un chemin critique de
  // latence.
  for (const { participantId } of nonRepondants) {
    // eslint-disable-next-line no-await-in-loop
    await relancer(contexte.cabinetId, seminaireId, participantId);
  }

  revalidatePath(`/organisateur/seminaires/${seminaireId}`);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/resultats`);
}
