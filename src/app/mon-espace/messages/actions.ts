'use server';

import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import {
  consulterReponseMessageAnonyme,
  envoyerMessageAnonyme,
  MessageAnonymeInvalideError,
  type ReponseMessageAnonyme,
} from '@/lib/anonymat';

export interface EtatEnvoiMessage {
  erreur?: string;
  code?: string;
}

export async function envoyerMessageAction(
  _etatPrecedent: EtatEnvoiMessage,
  formData: FormData,
): Promise<EtatEnvoiMessage> {
  const jeton = await lireJetonSession();
  if (!jeton) return { erreur: 'Accès introuvable.' };

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) return { erreur: 'Accès introuvable.' };

  const contenu = String(formData.get('contenu') ?? '');

  try {
    const code = await envoyerMessageAnonyme(contexte.seminaire.id, contenu);
    return { code };
  } catch (erreur) {
    if (erreur instanceof MessageAnonymeInvalideError) return { erreur: erreur.message };
    throw erreur;
  }
}

export interface EtatConsultationMessage {
  erreur?: string;
  reponse?: ReponseMessageAnonyme;
}

export async function consulterReponseAction(
  _etatPrecedent: EtatConsultationMessage,
  formData: FormData,
): Promise<EtatConsultationMessage> {
  const jeton = await lireJetonSession();
  if (!jeton) return { erreur: 'Accès introuvable.' };

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) return { erreur: 'Accès introuvable.' };

  const codeSuivi = String(formData.get('codeSuivi') ?? '');
  const reponse = await consulterReponseMessageAnonyme(contexte.seminaire.id, codeSuivi);
  if (!reponse) return { erreur: 'Code de suivi introuvable.' };

  return { reponse };
}
