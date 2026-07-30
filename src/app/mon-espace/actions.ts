'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant, type ContexteParticipant } from '@/lib/contexte-participant';
import { annulerInscription } from '@/lib/inscription';
import {
  InscriptionsFermeesError,
  SeminaireCompletError,
  SeminaireIndisponibleError,
  SeminaireTermineError,
  reactiverInscription,
} from '@/lib/inscription-publique';
import { enregistrerConsentement, retirerConsentement } from '@/lib/consentement';
import type { EtatActionEspace } from './types';

/**
 * Résout depuis le cookie de session, jamais depuis un identifiant fourni
 * par le client : ces actions ne peuvent donc jamais agir sur l'inscription
 * ou le consentement de quelqu'un d'autre.
 */
async function contexteCourantOuErreur(): Promise<ContexteParticipant> {
  const jeton = await lireJetonSession();
  if (!jeton) throw new Error('Session absente.');
  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) throw new Error('Session invalide.');
  return contexte;
}

export async function annulerInscriptionAction(): Promise<void> {
  const contexte = await contexteCourantOuErreur();
  await annulerInscription(contexte.inscription.id);
  revalidatePath('/mon-espace');
}

export async function reinscrireAction(
  _etatPrecedent: EtatActionEspace,
  _formData: FormData,
): Promise<EtatActionEspace> {
  const contexte = await contexteCourantOuErreur();

  try {
    await reactiverInscription({ seminaireId: contexte.seminaire.id, participantId: contexte.participant.id });
  } catch (erreur) {
    if (erreur instanceof SeminaireCompletError) return { erreur: 'Ce séminaire est complet.' };
    if (erreur instanceof InscriptionsFermeesError) return { erreur: 'Les inscriptions sont fermées pour ce séminaire.' };
    if (erreur instanceof SeminaireTermineError) return { erreur: 'Ce séminaire est terminé.' };
    if (erreur instanceof SeminaireIndisponibleError) return { erreur: "Ce séminaire n'est plus disponible." };
    throw erreur;
  }

  revalidatePath('/mon-espace');
  return {};
}

async function ipEtUserAgent() {
  const enTetes = await headers();
  return {
    ip: enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0',
    userAgent: enTetes.get('user-agent') ?? '',
  };
}

export async function retirerCommunicationsAction(): Promise<void> {
  const contexte = await contexteCourantOuErreur();
  await retirerConsentement(contexte.participant.id, 'COMMUNICATIONS');
  revalidatePath('/mon-espace');
}

export async function autoriserCommunicationsAction(): Promise<void> {
  const contexte = await contexteCourantOuErreur();
  const { ip, userAgent } = await ipEtUserAgent();
  await enregistrerConsentement({
    participantId: contexte.participant.id,
    inscriptionId: contexte.inscription.id,
    finalite: 'COMMUNICATIONS',
    ip,
    userAgent,
  });
  revalidatePath('/mon-espace');
}

export async function retirerPartageEmployeurAction(): Promise<void> {
  const contexte = await contexteCourantOuErreur();
  await retirerConsentement(contexte.participant.id, 'PARTAGE_EMPLOYEUR', contexte.inscription.id);
  revalidatePath('/mon-espace');
}

export async function autoriserPartageEmployeurAction(): Promise<void> {
  const contexte = await contexteCourantOuErreur();
  const { ip, userAgent } = await ipEtUserAgent();
  await enregistrerConsentement({
    participantId: contexte.participant.id,
    inscriptionId: contexte.inscription.id,
    finalite: 'PARTAGE_EMPLOYEUR',
    ip,
    userAgent,
  });
  revalidatePath('/mon-espace');
}
