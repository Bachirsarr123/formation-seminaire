'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import {
  analyserFormulaireFormateur,
  analyserFormulaireModification,
  analyserFormulaireOrganisateur,
} from '@/lib/organisateur/formulaire-equipe';
import {
  DernierOrganisateurActifError,
  EmailDejaUtiliseError,
  SuppressionImpossibleError,
  creerFormateur,
  creerOrganisateur,
  desactiverCompte,
  modifierMembre,
  supprimerMembre,
} from '@/lib/organisateur/equipe';
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

export async function creerOrganisateurAction(
  _etatPrecedent: EtatFormulaireFormateur,
  formData: FormData,
): Promise<EtatFormulaireFormateur> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireOrganisateur(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    await creerOrganisateur(contexte.cabinetId, donnees);
  } catch (e) {
    if (e instanceof EmailDejaUtiliseError) return { erreur: e.message };
    throw e;
  }

  revalidatePath('/organisateur/equipe');
  return { succes: true };
}

export interface EtatModificationMembre {
  erreur?: string;
  succes?: boolean;
}

export async function modifierMembreAction(
  utilisateurId: string,
  _etatPrecedent: EtatModificationMembre,
  formData: FormData,
): Promise<EtatModificationMembre> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireModification(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    const ok = await modifierMembre(contexte.cabinetId, utilisateurId, donnees);
    if (!ok) return { erreur: 'Compte introuvable.' };
  } catch (e) {
    if (e instanceof EmailDejaUtiliseError) return { erreur: e.message };
    throw e;
  }

  revalidatePath('/organisateur/equipe');
  return { succes: true };
}

export interface EtatSuppressionMembre {
  erreur?: string;
}

// Contrairement à desactiverCompteAction (jamais d'erreur attendue en usage
// normal, voir plus bas), la suppression peut légitimement échouer de deux
// façons prévisibles (dernier organisateur actif, données associées
// protégées) — useActionState côté appelant pour afficher ce message au lieu
// de le laisser remonter à error.tsx comme une erreur inattendue.
export async function supprimerMembreAction(
  utilisateurId: string,
  _etatPrecedent: EtatSuppressionMembre,
): Promise<EtatSuppressionMembre> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  try {
    const ok = await supprimerMembre(contexte.cabinetId, utilisateurId, contexte.utilisateurId);
    if (!ok) return { erreur: 'Compte introuvable.' };
  } catch (e) {
    if (e instanceof DernierOrganisateurActifError || e instanceof SuppressionImpossibleError) {
      return { erreur: e.message };
    }
    throw e;
  }

  revalidatePath('/organisateur/equipe');
  return {};
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
  let ok: boolean;
  try {
    ok = await enregistrerCvFormateur(contexte.cabinetId, utilisateurId, contenu);
  } catch (e) {
    // Jamais une page blanche pour un échec d'écriture (ex. la table de
    // stockage pas encore migrée en production) — un message clair, gardé
    // dans le formulaire, avec la possibilité de réessayer immédiatement.
    console.error('televerserCvAction: échec enregistrerCvFormateur', e);
    return { erreur: "Le téléversement a échoué. Réessayez dans un instant — si ça persiste, prévenez l'équipe technique." };
  }
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
  try {
    await enregistrerLogoCabinet(contexte.cabinetId, fichier.type, contenu);
  } catch (e) {
    console.error('televerserLogoCabinetAction: échec enregistrerLogoCabinet', e);
    return { erreur: "Le téléversement a échoué. Réessayez dans un instant — si ça persiste, prévenez l'équipe technique." };
  }

  revalidatePath('/organisateur/equipe');
  return {};
}
