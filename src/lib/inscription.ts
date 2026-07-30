import 'server-only';
import { Prisma, type Inscription, SourceInscription, StatutInscription } from '@prisma/client';
import { prisma } from './prisma';
import { genererJetonInscription } from './jeton';

type PrismaOuTx = typeof prisma | Prisma.TransactionClient;

interface InscrireParticipantParams {
  seminaireId: string;
  participantId: string;
  source: SourceInscription;
  // Défaut CONFIRMEE (comportement du lot 1). L'inscription publique (lot 2)
  // passe EN_ATTENTE quand seminaire.validationRequise est vrai.
  statutCible?: StatutInscription;
}

/**
 * Inscrit un participant à un séminaire. Si une ligne existe déjà pour ce
 * couple (seminaireId, participantId) — typiquement après une annulation —,
 * elle est réutilisée : seul `statut` est modifié.
 *
 * Le jeton n'est JAMAIS régénéré ici, y compris à la ré-inscription : c'est
 * l'identité durable du lien personnel, envoyé par SMS, mis en favori,
 * parfois transféré. Le régénérer casserait tous les liens déjà distribués.
 * Une régénération ne doit exister que comme action explicite de
 * l'organisateur (suspicion de fuite) — pas construite dans ce lot, et
 * certainement pas comme effet de bord d'une ré-inscription.
 *
 * `aRepondu` et `aReponduLe` ne sont JAMAIS réinitialisés par cette fonction,
 * quel que soit le nombre de cycles inscription/annulation/ré-inscription :
 * un participant qui a déjà répondu ne doit pas pouvoir répondre à nouveau
 * simplement en se réinscrivant. Ne pas les ajouter au bloc `update`
 * ci-dessous, même « pour remettre à zéro proprement ».
 *
 * Accepte un client Prisma/transaction optionnel pour pouvoir s'exécuter à
 * l'intérieur de la transaction verrouillée de la jauge de places (lot 2,
 * lib/inscription-publique.ts) — défaut au client singleton, rétro-compatible
 * avec les appels existants (seed, tests du lot 1).
 */
export async function inscrireParticipant(
  { seminaireId, participantId, source, statutCible = StatutInscription.CONFIRMEE }: InscrireParticipantParams,
  client: PrismaOuTx = prisma,
): Promise<Inscription> {
  return client.inscription.upsert({
    where: { seminaireId_participantId: { seminaireId, participantId } },
    create: {
      seminaireId,
      participantId,
      source,
      statut: statutCible,
      jeton: genererJetonInscription(),
    },
    update: {
      statut: statutCible,
    },
  });
}

export async function annulerInscription(
  inscriptionId: string,
  client: PrismaOuTx = prisma,
): Promise<Inscription> {
  return client.inscription.update({
    where: { id: inscriptionId },
    data: { statut: StatutInscription.ANNULEE },
  });
}
