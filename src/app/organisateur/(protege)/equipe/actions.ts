'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireFormateur } from '@/lib/organisateur/formulaire-equipe';
import { EmailDejaUtiliseError, creerFormateur, desactiverCompte } from '@/lib/organisateur/equipe';

// Les deux actions ci-dessous sont réservées aux organisateurs (rôle vérifié
// explicitement, jamais seulement la session) — la page elle-même l'exige
// déjà, mais une action reste accessible par son nom même sans lien visible.

export interface EtatFormulaireFormateur {
  erreur?: string;
  succes?: boolean;
}

export async function creerFormateurAction(
  _etatPrecedent: EtatFormulaireFormateur,
  formData: FormData,
): Promise<EtatFormulaireFormateur> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireFormateur(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    await creerFormateur(contexte.cabinetId, donnees);
  } catch (e) {
    if (e instanceof EmailDejaUtiliseError) return { erreur: e.message };
    throw e;
  }

  revalidatePath('/organisateur/equipe');
  return { succes: true };
}

// Pas de useActionState côté appelant : le bouton ne s'affiche jamais sur
// son propre compte (page.tsx), donc AutoDesactivationError n'est
// normalement jamais levée depuis cette action — si elle l'est malgré tout
// (accès direct, contournement), elle remonte à error.tsx comme toute autre
// erreur inattendue de l'espace organisateur, plutôt que d'échouer en
// silence.
export async function desactiverCompteAction(utilisateurId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await desactiverCompte(contexte.cabinetId, utilisateurId, contexte.utilisateurId);
  revalidatePath('/organisateur/equipe');
}
