'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireModele } from '@/lib/organisateur/formulaire-questionnaire';
import { archiverModele, creerModele } from '@/lib/organisateur/questionnaires';
import { dupliquerQuestionnaire } from '@/lib/questionnaire/dupliquer';

// Toutes les actions ci-dessous sont réservées aux organisateurs — la page
// elle-même l'exige déjà, mais une action reste accessible par son nom même
// sans lien visible (même discipline qu'équipe/étape 9).

export interface EtatFormulaireModele {
  erreur?: string;
}

export async function creerModeleAction(
  _etatPrecedent: EtatFormulaireModele,
  formData: FormData,
): Promise<EtatFormulaireModele> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireModele(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  const modele = await creerModele(contexte.cabinetId, donnees);
  redirect(`/organisateur/questionnaires/${modele.id}`);
}

// QuestionnaireIntrouvableError n'est normalement jamais atteinte depuis
// l'UI (le bouton ne porte que des id de modèles déjà listés pour CE
// cabinet) — si elle l'est malgré tout, elle remonte à error.tsx comme
// toute autre erreur inattendue, plutôt que d'échouer en silence.
export async function dupliquerModeleAction(modeleId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await dupliquerQuestionnaire(contexte.cabinetId, modeleId);
  revalidatePath('/organisateur/questionnaires');
}

export async function archiverModeleAction(modeleId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await archiverModele(contexte.cabinetId, modeleId);
  revalidatePath('/organisateur/questionnaires');
}
