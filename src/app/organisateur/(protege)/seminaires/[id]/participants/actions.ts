'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireParticipant } from '@/lib/organisateur/formulaire-participant';
import {
  ajouterParticipantManuel,
  annulerInscriptionOrganisateur,
  refuserInscription,
  regenererJetonParticipant,
  validerInscription,
} from '@/lib/organisateur/participants';

// Toutes les actions ci-dessous sont réservées aux organisateurs (rôle
// vérifié explicitement, jamais seulement la session) : un formateur est en
// lecture seule sur la liste des participants, comme sur la fiche séminaire.

export interface EtatFormulaireParticipant {
  erreur?: string;
  succes?: boolean;
}

export async function ajouterParticipantAction(
  seminaireId: string,
  _etatPrecedent: EtatFormulaireParticipant,
  formData: FormData,
): Promise<EtatFormulaireParticipant> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireParticipant(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  const inscription = await ajouterParticipantManuel(contexte.cabinetId, seminaireId, donnees);
  if (!inscription) return { erreur: 'Séminaire introuvable.' };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
  return { succes: true };
}

export async function validerInscriptionAction(seminaireId: string, inscriptionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await validerInscription(contexte.cabinetId, seminaireId, inscriptionId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
}

export async function refuserInscriptionAction(seminaireId: string, inscriptionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await refuserInscription(contexte.cabinetId, seminaireId, inscriptionId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
}

export async function annulerInscriptionAction(seminaireId: string, inscriptionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await annulerInscriptionOrganisateur(contexte.cabinetId, seminaireId, inscriptionId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
}

export interface EtatRegenerationJeton {
  fait?: boolean;
}

// Contrairement à supprimerSeminaireAction (qui redirige, donc démonte
// naturellement son propre encart de confirmation), cette action reste sur
// la même page : elle doit renvoyer un état (via useActionState côté
// composant) pour que BoutonRegenererJeton sache refermer son encart après
// coup, plutôt que de rester affiché indéfiniment après confirmation.
export async function regenererJetonAction(
  seminaireId: string,
  inscriptionId: string,
  _etatPrecedent: EtatRegenerationJeton,
  _formData: FormData,
): Promise<EtatRegenerationJeton> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await regenererJetonParticipant(contexte.cabinetId, seminaireId, inscriptionId, contexte.utilisateurId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
  return { fait: true };
}
