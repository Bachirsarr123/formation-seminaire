'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireSeminaire } from '@/lib/organisateur/formulaire-seminaire';
import { FormateurEtrangerError, creerSeminaire } from '@/lib/organisateur/seminaires';
import type { EtatFormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';

// Rôle vérifié explicitement (jamais seulement la session) : un formateur
// est en lecture seule, il ne crée jamais de séminaire.
export async function creerSeminaireAction(
  _etatPrecedent: EtatFormulaireSeminaire,
  formData: FormData,
): Promise<EtatFormulaireSeminaire> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireSeminaire(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  let seminaire;
  try {
    seminaire = await creerSeminaire(contexte.cabinetId, donnees);
  } catch (e) {
    if (e instanceof FormateurEtrangerError) return { erreur: e.message };
    throw e;
  }

  redirect(`/organisateur/seminaires/${seminaire.id}`);
}
