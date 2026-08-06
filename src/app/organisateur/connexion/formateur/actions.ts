'use server';

import { headers } from 'next/headers';
import { demanderLienMagique } from '@/lib/organisateur/lien-magique-formateur';
import { construireOrigineRequete } from '@/lib/origine-requete';

export interface EtatLienMagique {
  envoye?: boolean;
}

// Retourne toujours { envoye: true }, que le compte existe ou non, ou qu'il
// s'agisse d'un organisateur (mot de passe) plutôt que d'un formateur — même
// discipline de non-énumération que la réinitialisation de mot de passe.
export async function demanderLienMagiqueAction(
  _etatPrecedent: EtatLienMagique,
  formData: FormData,
): Promise<EtatLienMagique> {
  const email = String(formData.get('email') ?? '');
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);

  await demanderLienMagique(email, origine);

  return { envoye: true };
}
