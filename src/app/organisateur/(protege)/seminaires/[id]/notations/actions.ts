'use server';

import { revalidatePath } from 'next/cache';
import type { TypeNotation } from '@prisma/client';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { enregistrerNotation, lireValeurNotation, TYPES_NOTATION_VALIDES } from '@/lib/organisateur/notations';
import type { EtatNotation } from '@/components/formulaire-notation';

// exigerContexteOrganisateur() sans restriction de rôle : c'est
// enregistrerNotation qui refuse un organisateur (contrainte du lot — seul
// un formateur note), pas cette action — même discipline que le reste de
// l'espace organisateur, où le rôle est vérifié dans la fonction lib,
// jamais seulement par l'absence d'un bouton à l'écran.
export async function enregistrerNotationAction(
  seminaireId: string,
  inscriptionId: string,
  _etatPrecedent: EtatNotation,
  formData: FormData,
): Promise<EtatNotation> {
  const contexte = await exigerContexteOrganisateur();

  const typeBrut = String(formData.get('typeNotation') ?? '');
  if (!TYPES_NOTATION_VALIDES.includes(typeBrut as TypeNotation)) return { erreur: 'Type de notation invalide.' };

  const resultat = await enregistrerNotation(contexte.cabinetId, seminaireId, inscriptionId, contexte, {
    typeNotation: typeBrut as TypeNotation,
    valeur: lireValeurNotation(formData, 'valeur'),
    bareme: lireValeurNotation(formData, 'bareme'),
    justification: String(formData.get('justification') ?? ''),
  });

  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/notations`);
  return {};
}
