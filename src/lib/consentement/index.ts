import 'server-only';
import { createHmac } from 'node:crypto';
import { Prisma, type Consentement, type FinaliteConsentement } from '@prisma/client';
import { prisma } from '../prisma';
import { CONSENTEMENT_VERSION_ACTUELLE } from './textes';

type PrismaOuTx = typeof prisma | Prisma.TransactionClient;

// PARTAGE_EMPLOYEUR est scopé par inscription (l'employeur A n'implique pas
// l'employeur B) ; les deux autres finalités sont globales au participant.
const FINALITES_SCOPEES_PAR_INSCRIPTION: FinaliteConsentement[] = ['PARTAGE_EMPLOYEUR'];

function estScopeeParInscription(finalite: FinaliteConsentement): boolean {
  return FINALITES_SCOPEES_PAR_INSCRIPTION.includes(finalite);
}

function hacherPreuveConsentement(ip: string, userAgent: string): string {
  const secret = process.env.CONSENTEMENT_HASH_SECRET;
  if (!secret) throw new Error('CONSENTEMENT_HASH_SECRET manquant.');
  return createHmac('sha256', secret).update(`${ip}|${userAgent}`).digest('hex');
}

function requeteActif(
  participantId: string,
  finalite: FinaliteConsentement,
  inscriptionId?: string,
): Prisma.ConsentementWhereInput {
  if (estScopeeParInscription(finalite)) {
    if (!inscriptionId) {
      throw new Error(`${finalite} nécessite un inscriptionId (consentement scopé par formation).`);
    }
    return { participantId, inscriptionId, finalite, retireLe: null };
  }
  return { participantId, finalite, retireLe: null };
}

export async function estConsentementActif(
  participantId: string,
  finalite: FinaliteConsentement,
  inscriptionId?: string,
  client: PrismaOuTx = prisma,
): Promise<boolean> {
  const actif = await client.consentement.findFirst({ where: requeteActif(participantId, finalite, inscriptionId) });
  return actif !== null;
}

/**
 * Crée une ligne de consentement pour cette finalité si aucune n'est déjà
 * active — jamais de doublon actif, conformément aux index partiels de la
 * migration 20260730124642_ajout_consentement.
 */
export async function enregistrerConsentement(
  params: {
    participantId: string;
    inscriptionId: string;
    finalite: FinaliteConsentement;
    ip: string;
    userAgent: string;
  },
  client: PrismaOuTx = prisma,
): Promise<Consentement | null> {
  const { participantId, inscriptionId, finalite, ip, userAgent } = params;

  const dejaActif = await estConsentementActif(participantId, finalite, inscriptionId, client);
  if (dejaActif) return null;

  return client.consentement.create({
    data: {
      participantId,
      inscriptionId,
      finalite,
      versionTexte: CONSENTEMENT_VERSION_ACTUELLE,
      donneLe: new Date(),
      preuveHash: hacherPreuveConsentement(ip, userAgent),
    },
  });
}

/**
 * Orchestration appelée lors d'une inscription effectivement créée ou
 * réactivée (jamais sur le chemin "déjà inscrit, on renvoie le lien
 * existant" : rien de nouveau n'y est créé côté serveur, donc pas de
 * nouvel événement de consentement).
 */
export async function enregistrerConsentementsInscription(
  params: {
    participantId: string;
    inscriptionId: string;
    ip: string;
    userAgent: string;
    communicationsCoche: boolean;
    partageEmployeurCoche: boolean;
  },
  client: PrismaOuTx = prisma,
): Promise<void> {
  const { participantId, inscriptionId, ip, userAgent, communicationsCoche, partageEmployeurCoche } = params;

  await enregistrerConsentement(
    { participantId, inscriptionId, finalite: 'INSCRIPTION_EVALUATION', ip, userAgent },
    client,
  );

  if (communicationsCoche) {
    await enregistrerConsentement({ participantId, inscriptionId, finalite: 'COMMUNICATIONS', ip, userAgent }, client);
  }
  if (partageEmployeurCoche) {
    await enregistrerConsentement(
      { participantId, inscriptionId, finalite: 'PARTAGE_EMPLOYEUR', ip, userAgent },
      client,
    );
  }
}

export class ConsentementNonRetirableError extends Error {
  constructor() {
    super("INSCRIPTION_EVALUATION n'est pas un consentement : c'est la preuve d'une information donnée, non retirable.");
    this.name = 'ConsentementNonRetirableError';
  }
}

/**
 * Retire le consentement actif pour cette finalité (idempotent : si aucune
 * ligne active, ne fait rien). INSCRIPTION_EVALUATION est rejeté avant même
 * la requête — et de toute façon refusé en base par le trigger si jamais ce
 * garde-fou applicatif était contourné.
 */
export async function retirerConsentement(
  participantId: string,
  finalite: FinaliteConsentement,
  inscriptionId?: string,
): Promise<Consentement | null> {
  if (finalite === 'INSCRIPTION_EVALUATION') {
    throw new ConsentementNonRetirableError();
  }

  const actif = await prisma.consentement.findFirst({ where: requeteActif(participantId, finalite, inscriptionId) });
  if (!actif) return null;

  return prisma.consentement.update({ where: { id: actif.id }, data: { retireLe: new Date() } });
}
