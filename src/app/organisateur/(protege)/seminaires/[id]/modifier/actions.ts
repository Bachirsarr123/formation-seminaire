'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireSeminaire } from '@/lib/organisateur/formulaire-seminaire';
import { CapaciteInferieureAuxInscritsError, FormateurEtrangerError, modifierSeminaire } from '@/lib/organisateur/seminaires';
import type { EtatFormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';

export async function modifierSeminaireAction(
  seminaireId: string,
  _etatPrecedent: EtatFormulaireSeminaire,
  formData: FormData,
): Promise<EtatFormulaireSeminaire> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireSeminaire(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  try {
    const resultat = await modifierSeminaire(contexte.cabinetId, seminaireId, donnees);
    if (!resultat) return { erreur: 'Séminaire introuvable.' };
  } catch (e) {
    if (e instanceof CapaciteInferieureAuxInscritsError || e instanceof FormateurEtrangerError) {
      return { erreur: e.message };
    }
    throw e;
  }

  redirect(`/organisateur/seminaires/${seminaireId}`);
}
