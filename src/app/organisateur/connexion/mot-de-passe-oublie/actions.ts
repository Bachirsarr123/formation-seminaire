'use server';

import { headers } from 'next/headers';
import { demanderReinitialisation } from '@/lib/organisateur/reinitialisation-mot-de-passe';
import { construireOrigineRequete } from '@/lib/origine-requete';

export interface EtatMotDePasseOublie {
  envoye?: boolean;
}

// Retourne toujours { envoye: true }, que le compte existe ou non — jamais
// de branche qui confirmerait l'existence d'une adresse.
export async function demanderReinitialisationAction(
  _etatPrecedent: EtatMotDePasseOublie,
  formData: FormData,
): Promise<EtatMotDePasseOublie> {
  const email = String(formData.get('email') ?? '');
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);

  await demanderReinitialisation(email, origine);

  return { envoye: true };
}
