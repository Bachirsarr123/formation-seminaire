import 'server-only';
import { type Inscription, SourceInscription, StatutInscription } from '@prisma/client';
import { prisma } from '../prisma';
import { trouverOuCreerParticipant } from '../participant';
import { inscrireParticipant, annulerInscription } from '../inscription';
import { genererJetonInscription } from '../jeton';
import { SeminaireCompletError } from '../inscription-publique';

// ============================================================
// Gestion des inscrits d'un séminaire côté organisateur (lot 4, étape 6).
// Même règle B que seminaires.ts : cabinetId obligatoire partout, appliqué
// en clause WHERE — une ressource d'un autre cabinet renvoie null/false,
// jamais une erreur distincte (404, jamais 403, à l'appelant).
// ============================================================

export interface DonneesParticipantManuel {
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  organisation?: string | null;
}

export interface InscriptionAvecParticipant {
  id: string;
  statut: StatutInscription;
  source: SourceInscription;
  dateInscription: Date;
  aRepondu: boolean;
  jetonRegenereLe: Date | null;
  participant: {
    id: string;
    nom: string;
    prenom: string;
    email: string | null;
    telephone: string | null;
    fonction: string | null;
    organisation: string | null;
  };
}

const RANG_STATUT: Record<StatutInscription, number> = {
  EN_ATTENTE: 0,
  CONFIRMEE: 1,
  REFUSEE: 2,
  ANNULEE: 3,
};

/**
 * Liste les inscrits d'un séminaire, jointe au participant. `null` si le
 * séminaire n'existe pas ou appartient à un autre cabinet.
 *
 * Ne sélectionne délibérément PAS `aReponduLe` (seulement le booléen
 * `aRepondu`) : ce n'est pas qu'un choix d'affichage, la colonne n'est même
 * pas lue en base — impossible de la faire fuiter par erreur plus tard
 * (écran, export CSV) si elle n'a jamais été chargée. Ne pas l'ajouter au
 * `select` ci-dessous.
 */
export async function listerInscriptionsSeminaire(
  cabinetId: string,
  seminaireId: string,
  filtreStatut?: StatutInscription,
): Promise<InscriptionAvecParticipant[] | null> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!seminaire) return null;

  const inscriptions = await prisma.inscription.findMany({
    where: { seminaireId, ...(filtreStatut ? { statut: filtreStatut } : {}) },
    select: {
      id: true,
      statut: true,
      source: true,
      dateInscription: true,
      aRepondu: true,
      jetonRegenereLe: true,
      participant: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          fonction: true,
          organisation: true,
        },
      },
    },
  });

  // Tri en mémoire (pas de raw SQL) : le volume par séminaire reste borné
  // par capaciteMax, jamais assez grand pour justifier l'effort. EN_ATTENTE
  // d'abord (nécessite une action), puis ordre alphabétique.
  return inscriptions.sort(
    (a, b) =>
      RANG_STATUT[a.statut] - RANG_STATUT[b.statut] ||
      a.participant.nom.localeCompare(b.participant.nom) ||
      a.participant.prenom.localeCompare(b.participant.prenom),
  );
}

/**
 * Ajoute un participant à un séminaire depuis l'espace organisateur.
 * Toujours CONFIRMEE, jamais EN_ATTENTE même si `validationRequise` est
 * actif : ce réglage ne gouverne que l'auto-inscription publique, pas un
 * ajout que l'organisateur effectue lui-même en toute connaissance de cause.
 *
 * Aucun Consentement n'est enregistré ici, volontairement : un consentement
 * (lib/consentement/index.ts) est la preuve qu'une personne a ELLE-MÊME été
 * informée à cet instant — l'organisateur ne peut pas attester ce fait à la
 * place du participant. Seule l'auto-inscription publique (déjà en place)
 * en enregistre.
 *
 * Même pattern transaction + verrou `FOR UPDATE` sur la jauge de places que
 * `traiterInscriptionPublique` (lib/inscription-publique.ts) : la capacité
 * reste appliquée, l'organisateur doit augmenter `capaciteMax` (page
 * Modifier) s'il veut dépasser la limite plutôt que de la contourner
 * silencieusement.
 */
export async function ajouterParticipantManuel(
  cabinetId: string,
  seminaireId: string,
  donnees: DonneesParticipantManuel,
): Promise<Inscription | null> {
  const existe = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!existe) return null;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM seminaire WHERE id = ${seminaireId} FOR UPDATE`;

    const seminaire = await tx.seminaire.findUniqueOrThrow({ where: { id: seminaireId } });
    const participant = await trouverOuCreerParticipant({ cabinetId, ...donnees }, tx);

    const inscriptionExistante = await tx.inscription.findUnique({
      where: { seminaireId_participantId: { seminaireId, participantId: participant.id } },
    });

    if (!inscriptionExistante || inscriptionExistante.statut === StatutInscription.ANNULEE) {
      const occupees = await tx.inscription.count({
        where: { seminaireId, statut: { in: [StatutInscription.CONFIRMEE, StatutInscription.EN_ATTENTE] } },
      });
      if (seminaire.capaciteMax !== null && occupees >= seminaire.capaciteMax) {
        throw new SeminaireCompletError();
      }
    }

    return inscrireParticipant(
      { seminaireId, participantId: participant.id, source: SourceInscription.MANUEL, statutCible: StatutInscription.CONFIRMEE },
      tx,
    );
  });
}

async function obtenirInscriptionDuCabinet(
  cabinetId: string,
  seminaireId: string,
  inscriptionId: string,
): Promise<Inscription | null> {
  const seminaire = await prisma.seminaire.findFirst({ where: { id: seminaireId, cabinetId }, select: { id: true } });
  if (!seminaire) return null;
  return prisma.inscription.findFirst({ where: { id: inscriptionId, seminaireId } });
}

/**
 * EN_ATTENTE -> CONFIRMEE. Pas de nouveau contrôle de capacité ici : une
 * ligne EN_ATTENTE compte déjà comme occupée (le `occupees` de
 * traiterInscriptionPublique inclut CONFIRMEE ET EN_ATTENTE) — la place est
 * réservée depuis la création de la ligne, pas depuis sa validation. Un
 * refus/une annulation ailleurs libère donc immédiatement une place pour la
 * prochaine inscription, sans compteur caché à invalider : `occupees` est
 * toujours recalculé à la volée.
 */
export async function validerInscription(cabinetId: string, seminaireId: string, inscriptionId: string): Promise<boolean> {
  const inscription = await obtenirInscriptionDuCabinet(cabinetId, seminaireId, inscriptionId);
  if (!inscription || inscription.statut !== StatutInscription.EN_ATTENTE) return false;

  await prisma.inscription.update({ where: { id: inscription.id }, data: { statut: StatutInscription.CONFIRMEE } });
  return true;
}

export async function refuserInscription(cabinetId: string, seminaireId: string, inscriptionId: string): Promise<boolean> {
  const inscription = await obtenirInscriptionDuCabinet(cabinetId, seminaireId, inscriptionId);
  if (!inscription || inscription.statut !== StatutInscription.EN_ATTENTE) return false;

  await prisma.inscription.update({ where: { id: inscription.id }, data: { statut: StatutInscription.REFUSEE } });
  return true;
}

export async function annulerInscriptionOrganisateur(
  cabinetId: string,
  seminaireId: string,
  inscriptionId: string,
): Promise<boolean> {
  const inscription = await obtenirInscriptionDuCabinet(cabinetId, seminaireId, inscriptionId);
  if (!inscription || inscription.statut === StatutInscription.ANNULEE) return false;

  await annulerInscription(inscription.id);
  return true;
}

/**
 * Régénère le jeton personnel d'une inscription (suspicion de fuite du
 * lien) — action explicite de l'organisateur, jamais un effet de bord d'une
 * ré-inscription (cf. commentaire sur inscrireParticipant, lib/inscription.ts).
 * L'ancien jeton cesse immédiatement de fonctionner, y compris s'il a été
 * transféré ou mis en favori : `jeton` est la colonne unique résolue par
 * /p/{jeton}, la remplacer invalide l'ancien lien partout où il circulait.
 */
export async function regenererJetonParticipant(
  cabinetId: string,
  seminaireId: string,
  inscriptionId: string,
  utilisateurId: string,
): Promise<string | null> {
  const inscription = await obtenirInscriptionDuCabinet(cabinetId, seminaireId, inscriptionId);
  if (!inscription) return null;

  const jeton = genererJetonInscription();
  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { jeton, jetonRegenereLe: new Date(), jetonRegenereParId: utilisateurId },
  });
  return jeton;
}
