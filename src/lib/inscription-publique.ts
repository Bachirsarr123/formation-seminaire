import 'server-only';
import { SourceInscription, StatutInscription } from '@prisma/client';
import { prisma } from './prisma';
import { trouverOuCreerParticipant } from './participant';
import { inscrireParticipant } from './inscription';
import { enregistrerConsentementsInscription } from './consentement';

export class SeminaireIndisponibleError extends Error {
  constructor() {
    super('Ce séminaire n\'est plus disponible.');
    this.name = 'SeminaireIndisponibleError';
  }
}
export class SeminaireTermineError extends Error {
  constructor() {
    super('Ce séminaire est terminé.');
    this.name = 'SeminaireTermineError';
  }
}
export class InscriptionsFermeesError extends Error {
  constructor() {
    super('Les inscriptions sont fermées pour ce séminaire.');
    this.name = 'InscriptionsFermeesError';
  }
}

interface TraiterInscriptionPubliqueParams {
  seminaireId: string;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  organisation?: string | null;
  ip: string;
  userAgent: string;
  communicationsCoche: boolean;
  partageEmployeurCoche: boolean;
}

interface ResultatInscriptionPublique {
  jeton: string;
  participantId: string;
  statut: StatutInscription;
  dateFinSeminaire: Date;
  // Distingue les cas pour l'appelant (ex. n'envoyer le lien par notification
  // que si quelque chose a réellement changé), sans jamais afficher d'erreur
  // à l'utilisateur dans le cas "dejaActive".
  situation: 'nouvelle' | 'reactivee' | 'dejaActive';
}

/**
 * Traite une auto-inscription publique (formulaire /s/{codePublic}/inscription).
 * Précondition : le séminaire existe et son statut/date ont déjà été
 * présentés à l'utilisateur par la page publique — les vérifications
 * ci-dessous sont une défense en profondeur contre un appel direct de
 * l'action (curl, requête rejouée), pas la seule barrière.
 *
 * Aucune jauge de places : le verrou explicite sur la ligne `seminaire` sert
 * uniquement à sérialiser l'upsert d'inscription lui-même (éviter deux lignes
 * concurrentes pour le même couple séminaire/participant), pas une capacité.
 */
export async function traiterInscriptionPublique(
  params: TraiterInscriptionPubliqueParams,
): Promise<ResultatInscriptionPublique> {
  return prisma.$transaction(async (tx) => {
    // Verrou explicite : toute autre transaction inscrivant quelqu'un sur ce
    // même séminaire attend ici jusqu'à ce que celle-ci commit ou échoue.
    await tx.$queryRaw`SELECT id FROM seminaire WHERE id = ${params.seminaireId} FOR UPDATE`;

    const seminaire = await tx.seminaire.findUniqueOrThrow({ where: { id: params.seminaireId } });

    if (seminaire.statut === 'BROUILLON' || seminaire.supprimeLe !== null) {
      throw new SeminaireIndisponibleError();
    }
    if (seminaire.dateFin < new Date()) {
      throw new SeminaireTermineError();
    }
    if (!seminaire.inscriptionOuverte) {
      throw new InscriptionsFermeesError();
    }

    const participant = await trouverOuCreerParticipant(
      {
        cabinetId: seminaire.cabinetId,
        nom: params.nom,
        prenom: params.prenom,
        email: params.email,
        telephone: params.telephone,
        fonction: params.fonction,
        organisation: params.organisation,
      },
      tx,
    );

    const inscriptionExistante = await tx.inscription.findUnique({
      where: { seminaireId_participantId: { seminaireId: seminaire.id, participantId: participant.id } },
    });

    if (inscriptionExistante && inscriptionExistante.statut !== StatutInscription.ANNULEE) {
      // Déjà inscrit et actif (CONFIRMEE ou EN_ATTENTE) : aucune place
      // supplémentaire consommée, aucune erreur — on renvoie simplement son
      // lien existant. Aucun nouvel événement de consentement non plus,
      // puisque rien de nouveau n'est créé côté serveur.
      return {
        jeton: inscriptionExistante.jeton,
        participantId: participant.id,
        statut: inscriptionExistante.statut,
        dateFinSeminaire: seminaire.dateFin,
        situation: 'dejaActive' as const,
      };
    }

    const statutCible = seminaire.validationRequise ? StatutInscription.EN_ATTENTE : StatutInscription.CONFIRMEE;
    const inscription = await inscrireParticipant(
      {
        seminaireId: seminaire.id,
        participantId: participant.id,
        source: SourceInscription.AUTO_INSCRIPTION,
        statutCible,
      },
      tx,
    );

    await enregistrerConsentementsInscription(
      {
        participantId: participant.id,
        inscriptionId: inscription.id,
        ip: params.ip,
        userAgent: params.userAgent,
        communicationsCoche: params.communicationsCoche,
        partageEmployeurCoche: params.partageEmployeurCoche,
      },
      tx,
    );

    return {
      jeton: inscription.jeton,
      participantId: participant.id,
      statut: inscription.statut,
      dateFinSeminaire: seminaire.dateFin,
      situation: inscriptionExistante ? ('reactivee' as const) : ('nouvelle' as const),
    };
  });
}

/**
 * Réactive depuis /mon-espace une inscription ANNULEE du même participant
 * (bouton « Me réinscrire »). Même verrou de jauge que l'inscription
 * publique — le séminaire a pu se remplir pendant l'annulation — mais sans
 * recréer le participant (déjà connu) ni redemander les consentements : la
 * ligne réutilisée conserve son jeton (jamais régénéré) et les consentements
 * déjà donnés pour cette inscription restent valables tels quels.
 */
export async function reactiverInscription(params: {
  seminaireId: string;
  participantId: string;
}): Promise<{ jeton: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM seminaire WHERE id = ${params.seminaireId} FOR UPDATE`;

    const seminaire = await tx.seminaire.findUniqueOrThrow({ where: { id: params.seminaireId } });

    if (seminaire.statut === 'BROUILLON' || seminaire.supprimeLe !== null) {
      throw new SeminaireIndisponibleError();
    }
    if (seminaire.dateFin < new Date()) {
      throw new SeminaireTermineError();
    }
    if (!seminaire.inscriptionOuverte) {
      throw new InscriptionsFermeesError();
    }

    const statutCible = seminaire.validationRequise ? StatutInscription.EN_ATTENTE : StatutInscription.CONFIRMEE;
    const inscription = await inscrireParticipant(
      {
        seminaireId: seminaire.id,
        participantId: params.participantId,
        source: SourceInscription.AUTO_INSCRIPTION,
        statutCible,
      },
      tx,
    );

    return { jeton: inscription.jeton };
  });
}
