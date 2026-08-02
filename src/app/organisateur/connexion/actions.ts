'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ConnexionTemporiseeError, IdentifiantsInvalidesError, connecterOrganisateur } from '@/lib/organisateur/auth';
import { creerSessionOrganisateur } from '@/lib/organisateur/session';

export interface EtatConnexion {
  erreur?: string;
}

export async function connecterAction(_etatPrecedent: EtatConnexion, formData: FormData): Promise<EtatConnexion> {
  const email = String(formData.get('email') ?? '');
  const motDePasse = String(formData.get('motDePasse') ?? '');

  const enTetes = await headers();
  const ip = enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';

  try {
    const { utilisateurId } = await connecterOrganisateur({ email, motDePasse, ip });
    await creerSessionOrganisateur(utilisateurId);
  } catch (erreur) {
    if (erreur instanceof IdentifiantsInvalidesError || erreur instanceof ConnexionTemporiseeError) {
      return { erreur: erreur.message };
    }
    throw erreur;
  }

  redirect('/organisateur');
}
