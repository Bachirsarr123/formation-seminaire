import 'server-only';
import { Prisma, type Participant } from '@prisma/client';
import { prisma } from './prisma';
import { normaliserEmail, normaliserNom, normaliserTelephone } from './normalisation';

type PrismaOuTx = typeof prisma | Prisma.TransactionClient;

interface DonneesParticipant {
  cabinetId: string;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  organisation?: string | null;
}

/**
 * Cherche un participant existant dans le cabinet par email OU téléphone
 * normalisé ; le met à jour si trouvé, le crée sinon. Les deux index uniques
 * partiels (cabinet_id, email) / (cabinet_id, telephone) — migration
 * 20260730131832 — ferment la fenêtre de course où deux inscriptions
 * concurrentes de la même personne ne trouveraient, l'une et l'autre, aucun
 * participant existant : en cas de violation, on relit et on met à jour
 * plutôt que de laisser planter l'inscription.
 */
export async function trouverOuCreerParticipant(
  donnees: DonneesParticipant,
  client: PrismaOuTx = prisma,
): Promise<Participant> {
  const email = normaliserEmail(donnees.email);
  const telephone = normaliserTelephone(donnees.telephone);
  const nom = normaliserNom(donnees.nom);
  const prenom = normaliserNom(donnees.prenom);

  const existant = await client.participant.findFirst({
    where: {
      cabinetId: donnees.cabinetId,
      OR: [
        ...(email ? [{ email }] : []),
        ...(telephone ? [{ telephone }] : []),
      ],
    },
  });

  const champs = {
    nom,
    prenom,
    email,
    telephone,
    fonction: donnees.fonction?.trim() || null,
    organisation: donnees.organisation?.trim() || null,
  };

  if (existant) {
    return client.participant.update({ where: { id: existant.id }, data: champs });
  }

  try {
    return await client.participant.create({ data: { cabinetId: donnees.cabinetId, ...champs } });
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
      // Violation d'un des deux index partiels : une requête concurrente a
      // créé le participant entre notre lecture et notre écriture. On relit
      // et on met à jour plutôt que d'échouer.
      const creeEntreTemps = await client.participant.findFirstOrThrow({
        where: {
          cabinetId: donnees.cabinetId,
          OR: [...(email ? [{ email }] : []), ...(telephone ? [{ telephone }] : [])],
        },
      });
      return client.participant.update({ where: { id: creeEntreTemps.id }, data: champs });
    }
    throw erreur;
  }
}
