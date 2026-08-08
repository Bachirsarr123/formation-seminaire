'use server';

import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
import { envoyerRelanceQuestionnaire } from '@/lib/notification';

// Réservée aux organisateurs — le formateur a un accès lecture seule à cet
// écran (contrainte du lot). Message transactionnel (découle du rappel
// qu'un participant a déjà accepté en s'inscrivant), jamais conditionné au
// consentement COMMUNICATIONS — voir lib/notification.ts, qui distingue
// explicitement les deux familles.
export async function relancerNonRepondantAction(seminaireId: string, participantId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId: contexte.cabinetId, supprimeLe: null },
    select: { titre: true },
  });
  if (!seminaire) return;

  // Revérifié en base plutôt que de faire confiance aux valeurs affichées à
  // l'écran : seul un inscrit CONFIRMEE n'ayant pas répondu doit pouvoir
  // être relancé, quoi que le formulaire ait transmis.
  const inscription = await prisma.inscription.findFirst({
    where: { seminaireId, participantId, statut: 'CONFIRMEE', aRepondu: false },
    select: {
      participant: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
    },
  });
  if (!inscription) return;

  await envoyerRelanceQuestionnaire(
    {
      participantId: inscription.participant.id,
      nom: inscription.participant.nom,
      prenom: inscription.participant.prenom,
      email: inscription.participant.email,
      telephone: inscription.participant.telephone,
    },
    seminaire.titre,
  );
}
