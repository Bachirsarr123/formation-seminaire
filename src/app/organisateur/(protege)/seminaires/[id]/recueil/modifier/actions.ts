'use server';

import { revalidatePath } from 'next/cache';
import type { TypeRecueilQuestion } from '@prisma/client';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { ajouterQuestionRecueil, supprimerQuestionRecueil } from '@/lib/organisateur/recueil';

export interface EtatFormulaireQuestionRecueil {
  erreur?: string;
}

const NB_CHOIX = 8;
const TYPES_VALIDES: TypeRecueilQuestion[] = ['TEXTE_LIBRE', 'CHOIX_UNIQUE', 'CHOIX_MULTIPLE'];

function analyserOptions(formData: FormData, type: TypeRecueilQuestion): unknown {
  if (type === 'TEXTE_LIBRE') return undefined;

  const choix: { id: string; libelle: string }[] = [];
  for (let i = 1; i <= NB_CHOIX; i++) {
    const libelle = String(formData.get(`choixLibelle${i}`) ?? '').trim();
    if (libelle) choix.push({ id: `c${i}`, libelle });
  }
  if (choix.length === 0) return undefined;

  const avecAutre = type === 'CHOIX_MULTIPLE' && formData.get('avecAutre') !== null;
  return { choix, avecAutre };
}

export async function ajouterQuestionRecueilAction(
  seminaireId: string,
  recueilId: string,
  _etatPrecedent: EtatFormulaireQuestionRecueil,
  formData: FormData,
): Promise<EtatFormulaireQuestionRecueil> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const intitule = String(formData.get('intitule') ?? '').trim();
  const typeBrut = String(formData.get('type') ?? '');
  if (!intitule) return { erreur: "L'intitulé est obligatoire." };
  if (!TYPES_VALIDES.includes(typeBrut as TypeRecueilQuestion)) return { erreur: 'Type invalide.' };
  const type = typeBrut as TypeRecueilQuestion;

  const options = analyserOptions(formData, type);
  if (type !== 'TEXTE_LIBRE' && !options) {
    return { erreur: 'Renseignez au moins un choix pour ce type de question.' };
  }

  const question = await ajouterQuestionRecueil(contexte.cabinetId, recueilId, { intitule, type, options });
  if (!question) return { erreur: 'Recueil introuvable.' };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/recueil/modifier`);
  return {};
}

export async function supprimerQuestionRecueilAction(seminaireId: string, recueilId: string, questionId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await supprimerQuestionRecueil(contexte.cabinetId, recueilId, questionId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/recueil/modifier`);
}
