'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { marquerMessageLu, marquerMessageTraite, repondreMessageAnonyme } from '@/lib/anonymat';

export interface EtatReponseMessage {
  erreur?: string;
}

export async function repondreMessageAction(
  seminaireId: string,
  messageId: string,
  _etatPrecedent: EtatReponseMessage,
  formData: FormData,
): Promise<EtatReponseMessage> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const reponse = String(formData.get('reponse') ?? '');
  if (!reponse.trim()) return { erreur: 'La réponse ne peut pas être vide.' };

  const ok = await repondreMessageAnonyme(contexte.cabinetId, seminaireId, messageId, reponse);
  if (!ok) return { erreur: 'Message introuvable.' };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/messages`);
  return {};
}

export async function marquerMessageLuAction(seminaireId: string, messageId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await marquerMessageLu(contexte.cabinetId, seminaireId, messageId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/messages`);
}

export async function marquerMessageTraiteAction(seminaireId: string, messageId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await marquerMessageTraite(contexte.cabinetId, seminaireId, messageId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/messages`);
}
