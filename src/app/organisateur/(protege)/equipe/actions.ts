'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireFormateur } from '@/lib/organisateur/formulaire-equipe';
import { EmailDejaUtiliseError, creerFormateur, desactiverCompte } from '@/lib/organisateur/equipe';
import { enregistrerCvFormateur, erreurCvInvalide } from '@/lib/organisateur/cv-formateur';
import { enregistrerLogoCabinet, erreurLogoCabinetInvalide } from '@/lib/organisateur/logo-cabinet';

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

export interface EtatUploadCv {
  erreur?: string;
}

export async function televerserCvAction(
  utilisateurId: string,
  _etatPrecedent: EtatUploadCv,
  formData: FormData,
): Promise<EtatUploadCv> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = formData.get('cv');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez un fichier.' };
  }

  const erreurValidation = erreurCvInvalide(fichier.type, fichier.size);
  if (erreurValidation) return { erreur: erreurValidation };

  const contenu = Buffer.from(await fichier.arrayBuffer());
  const ok = await enregistrerCvFormateur(contexte.cabinetId, utilisateurId, fichier.name, contenu);
  if (!ok) return { erreur: 'Formateur introuvable.' };

  revalidatePath('/organisateur/equipe');
  return {};
}

export interface EtatUploadLogoCabinet {
  erreur?: string;
}

export async function televerserLogoCabinetAction(
  _etatPrecedent: EtatUploadLogoCabinet,
  formData: FormData,
): Promise<EtatUploadLogoCabinet> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = formData.get('logo');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez un fichier.' };
  }

  const erreurValidation = erreurLogoCabinetInvalide(fichier.type, fichier.size);
  if (erreurValidation) return { erreur: erreurValidation };

  const contenu = Buffer.from(await fichier.arrayBuffer());
  await enregistrerLogoCabinet(contexte.cabinetId, fichier.name, contenu);

  revalidatePath('/organisateur/equipe');
  return {};
}
