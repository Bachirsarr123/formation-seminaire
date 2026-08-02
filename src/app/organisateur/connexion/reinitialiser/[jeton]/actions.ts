'use server';

import { redirect } from 'next/navigation';
import { JetonInvalideError, reinitialiserMotDePasse } from '@/lib/organisateur/reinitialisation-mot-de-passe';

export interface EtatReinitialiser {
  erreur?: string;
}

const LONGUEUR_MINIMALE = 12;

export async function reinitialiserAction(
  _etatPrecedent: EtatReinitialiser,
  formData: FormData,
): Promise<EtatReinitialiser> {
  const jeton = String(formData.get('jeton') ?? '');
  const motDePasse = String(formData.get('motDePasse') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return { erreur: `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.` };
  }
  if (motDePasse !== confirmation) {
    return { erreur: 'Les deux mots de passe ne correspondent pas.' };
  }

  try {
    await reinitialiserMotDePasse(jeton, motDePasse);
  } catch (erreur) {
    if (erreur instanceof JetonInvalideError) return { erreur: erreur.message };
    throw erreur;
  }

  redirect('/organisateur/connexion?reinitialise=1');
}
