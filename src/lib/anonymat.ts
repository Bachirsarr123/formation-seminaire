import 'server-only';
import type { StatutMessage } from '@prisma/client';
import { prisma } from './prisma';
import { genererCodeSuiviMessage } from './jeton';
import { hacherJeton } from './organisateur/jeton-hash';

interface MessageAnonymeVisible {
  id: string;
  contenu: string;
  jourEnvoi: Date;
  statut: StatutMessage;
  reponseOrganisateur: string | null;
  dateReponse: Date | null;
}

interface ListeMessagesAnonymes {
  visible: boolean;
  total: number;
  messages: MessageAnonymeVisible[];
}

/**
 * Un message anonyme n'est visible par l'organisateur que si le séminaire en
 * compte au moins `seuilAnonymat` (défaut 5). En dessous, liste vide + total
 * réel (l'organisateur sait combien il y en a, jamais leur contenu).
 * Au-dessus, tous les messages sont retournés dans un ordre mélangé — jamais
 * l'ordre chronologique, qui trahirait qui a écrit en premier.
 */
export async function listerMessagesAnonymes(
  seminaireId: string,
  seuilAnonymat: number,
): Promise<ListeMessagesAnonymes> {
  const total = await prisma.messageAnonyme.count({ where: { seminaireId } });

  if (total < seuilAnonymat) {
    return { visible: false, total, messages: [] };
  }

  const messages = await prisma.messageAnonyme.findMany({
    where: { seminaireId },
    select: {
      id: true,
      contenu: true,
      jourEnvoi: true,
      statut: true,
      reponseOrganisateur: true,
      dateReponse: true,
    },
  });

  return { visible: true, total, messages: melangerAleatoirement(messages) };
}

// Exporté : réutilisé par lib/questionnaire/resultats.ts (mêmes règles de
// mélange pour les réponses ouvertes du questionnaire d'évaluation) — un
// seul générateur, pas une seconde copie qui pourrait diverger.
export function melangerAleatoirement<T>(items: T[]): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copie[i] as T;
    copie[i] = copie[j] as T;
    copie[j] = temp;
  }
  return copie;
}

// ============================================================
// Envoi et consultation côté participant. Aucune colonne d'identité sur
// MessageAnonyme (ni participantId, ni inscriptionId) — le lien avec
// l'auteur n'existe NULLE PART en base, pas seulement caché à l'écran :
// l'organisateur ne peut littéralement pas le retrouver, même en accès
// direct à la base. Le code de suivi est le SEUL canal de retour, et
// uniquement pour son détenteur (haché en base, jamais en clair — voir
// hacherJeton, lib/organisateur/jeton-hash.ts, déjà utilisé pour les jetons
// de session/réinitialisation : même raisonnement, forte entropie donc pas
// besoin d'un hash lent salé).
// ============================================================

const LONGUEUR_MAX_MESSAGE = 2000;

export class MessageAnonymeInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageAnonymeInvalideError';
  }
}

/**
 * Renvoie le code de suivi EN CLAIR — la seule fois où il existe sous cette
 * forme. L'appelant (Server Action) doit l'afficher immédiatement au
 * participant : il n'est jamais récupérable ensuite, ni par nous, ni par
 * l'organisateur, ni par le participant lui-même s'il le perd.
 */
export async function envoyerMessageAnonyme(seminaireId: string, contenu: string): Promise<string> {
  const nettoye = contenu.trim();
  if (!nettoye) throw new MessageAnonymeInvalideError('Le message ne peut pas être vide.');
  if (nettoye.length > LONGUEUR_MAX_MESSAGE) {
    throw new MessageAnonymeInvalideError(`${LONGUEUR_MAX_MESSAGE} caractères maximum.`);
  }

  const code = genererCodeSuiviMessage();
  await prisma.messageAnonyme.create({
    data: { seminaireId, contenu: nettoye, codeSuiviHash: hacherJeton(code) },
  });

  return code;
}

export interface ReponseMessageAnonyme {
  contenu: string;
  statut: StatutMessage;
  reponseOrganisateur: string | null;
}

// Un code de suivi ne contient que des caractères alphanumériques (nanoid) —
// tout séparateur ajouté par l'affichage (espaces, tirets) est retiré avant
// hachage, pour que la façon dont le participant l'a retranscrit (avec ou
// sans les tirets de lecture) n'ait pas d'importance.
function normaliserCodeSuivi(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function consulterReponseMessageAnonyme(
  seminaireId: string,
  codeSuivi: string,
): Promise<ReponseMessageAnonyme | null> {
  const nettoye = normaliserCodeSuivi(codeSuivi);
  if (!nettoye) return null;

  return prisma.messageAnonyme.findFirst({
    where: { seminaireId, codeSuiviHash: hacherJeton(nettoye) },
    select: { contenu: true, statut: true, reponseOrganisateur: true },
  });
}

// ============================================================
// Actions organisateur (répondre, marquer lu/traité) — même règle B que
// lib/organisateur/* : cabinetId obligatoire, vérifié via l'appartenance du
// séminaire avant toute écriture (défense en profondeur : la page appelante
// vérifie déjà l'accès, mais une mutation ne doit jamais dépendre
// uniquement de ça).
// ============================================================

async function verifierAccesSeminaire(cabinetId: string, seminaireId: string): Promise<boolean> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  return seminaire !== null;
}

/** Répondre marque aussi le message TRAITE — une réponse écrite EST la résolution. */
export async function repondreMessageAnonyme(
  cabinetId: string,
  seminaireId: string,
  messageId: string,
  reponse: string,
): Promise<boolean> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return false;

  const nettoyee = reponse.trim();
  if (!nettoyee) return false;

  const resultat = await prisma.messageAnonyme.updateMany({
    where: { id: messageId, seminaireId },
    data: { reponseOrganisateur: nettoyee, dateReponse: new Date(), statut: 'TRAITE' },
  });
  return resultat.count > 0;
}

export async function marquerMessageLu(cabinetId: string, seminaireId: string, messageId: string): Promise<boolean> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return false;

  const resultat = await prisma.messageAnonyme.updateMany({
    where: { id: messageId, seminaireId },
    data: { statut: 'LU' },
  });
  return resultat.count > 0;
}

/** Pour un message résolu SANS réponse écrite (ex. traité de vive voix) — repondreMessageAnonyme couvre déjà le cas avec réponse. */
export async function marquerMessageTraite(cabinetId: string, seminaireId: string, messageId: string): Promise<boolean> {
  if (!(await verifierAccesSeminaire(cabinetId, seminaireId))) return false;

  const resultat = await prisma.messageAnonyme.updateMany({
    where: { id: messageId, seminaireId },
    data: { statut: 'TRAITE' },
  });
  return resultat.count > 0;
}
