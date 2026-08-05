'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireQuestion, analyserFormulaireSection } from '@/lib/organisateur/formulaire-editeur-questionnaire';
import {
  StructureVerrouilleeError,
  ajouterQuestion,
  ajouterSection,
  deplacerQuestion,
  deplacerSection,
  supprimerQuestion,
  supprimerSection,
  type Direction,
} from '@/lib/questionnaire/editeur';
import { dupliquerQuestionnaire } from '@/lib/questionnaire/dupliquer';

// Réservées aux organisateurs — la page l'exige déjà, même discipline
// qu'ailleurs dans l'espace organisateur (rôle vérifié explicitement).

export interface EtatFormulaireEditeur {
  erreur?: string;
}

export async function ajouterSectionAction(
  questionnaireId: string,
  _etatPrecedent: EtatFormulaireEditeur,
  formData: FormData,
): Promise<EtatFormulaireEditeur> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireSection(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    await ajouterSection(contexte.cabinetId, questionnaireId, donnees);
  } catch (e) {
    if (e instanceof StructureVerrouilleeError) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
  return {};
}

export async function deplacerSectionAction(questionnaireId: string, sectionId: string, direction: Direction): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await deplacerSection(contexte.cabinetId, sectionId, direction);
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
}

export async function supprimerSectionAction(questionnaireId: string, sectionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await supprimerSection(contexte.cabinetId, sectionId);
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
}

export async function ajouterQuestionAction(
  questionnaireId: string,
  sectionId: string,
  _etatPrecedent: EtatFormulaireEditeur,
  formData: FormData,
): Promise<EtatFormulaireEditeur> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireQuestion(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    await ajouterQuestion(contexte.cabinetId, sectionId, donnees);
  } catch (e) {
    if (e instanceof StructureVerrouilleeError) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
  return {};
}

export async function deplacerQuestionAction(questionnaireId: string, questionId: string, direction: Direction): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await deplacerQuestion(contexte.cabinetId, questionId, direction);
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
}

export async function supprimerQuestionAction(questionnaireId: string, questionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await supprimerQuestion(contexte.cabinetId, questionId);
  revalidatePath(`/organisateur/questionnaires/${questionnaireId}`);
}

// Seule voie une fois la structure figée (bandeau de verrouillage,
// page.tsx) : une nouvelle copie BROUILLON, prête à être modifiée.
export async function dupliquerQuestionnaireAction(questionnaireId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const copie = await dupliquerQuestionnaire(contexte.cabinetId, questionnaireId);
  redirect(`/organisateur/questionnaires/${copie.id}`);
}
