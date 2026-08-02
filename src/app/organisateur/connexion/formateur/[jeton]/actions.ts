'use server';

import { redirect } from 'next/navigation';
import { JetonInvalideError, consommerLienMagique } from '@/lib/organisateur/lien-magique-formateur';
import { creerSessionOrganisateur } from '@/lib/organisateur/session';

export interface EtatConfirmerLienMagique {
  erreur?: string;
}

export async function confirmerLienMagiqueAction(
  _etatPrecedent: EtatConfirmerLienMagique,
  formData: FormData,
): Promise<EtatConfirmerLienMagique> {
  const jeton = String(formData.get('jeton') ?? '');

  try {
    const { utilisateurId } = await consommerLienMagique(jeton);
    await creerSessionOrganisateur(utilisateurId);
  } catch (erreur) {
    if (erreur instanceof JetonInvalideError) return { erreur: erreur.message };
    throw erreur;
  }

  redirect('/organisateur');
}
