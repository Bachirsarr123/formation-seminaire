'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireQuestion } from '@/lib/organisateur/formulaire-editeur-questionnaire';
import { StructureVerrouilleeError, modifierQuestion } from '@/lib/questionnaire/editeur';
import type { EtatFormulaireQuestion } from '@/components/organisateur/formulaire-question';

export async function modifierQuestionAction(
  questionnaireId: string,
  questionId: string,
  _etatPrecedent: EtatFormulaireQuestion,
  formData: FormData,
): Promise<EtatFormulaireQuestion> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireQuestion(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    await modifierQuestion(contexte.cabinetId, questionId, donnees);
  } catch (e) {
    if (e instanceof StructureVerrouilleeError) return { erreur: e.message };
    throw e;
  }

  redirect(`/organisateur/questionnaires/${questionnaireId}`);
}
