'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { creerRecueil } from '@/lib/organisateur/recueil';

export interface EtatFormulaireCreerRecueil {
  erreur?: string;
}

export async function creerRecueilAction(
  seminaireId: string,
  _etatPrecedent: EtatFormulaireCreerRecueil,
  formData: FormData,
): Promise<EtatFormulaireCreerRecueil> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const titre = String(formData.get('titre') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!titre) return { erreur: 'Le titre est obligatoire.' };
  if (!description) return { erreur: "Le texte d'objectif est obligatoire." };

  const recueil = await creerRecueil(contexte.cabinetId, seminaireId, { titre, description });
  if (!recueil) return { erreur: 'Séminaire introuvable.' };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/recueil`);
  return {};
}
