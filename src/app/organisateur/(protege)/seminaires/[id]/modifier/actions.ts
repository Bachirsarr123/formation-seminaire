'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireSeminaire } from '@/lib/organisateur/formulaire-seminaire';
import { CapaciteInferieureAuxInscritsError, FormateurEtrangerError, modifierSeminaire } from '@/lib/organisateur/seminaires';
import { enregistrerLogoClient, erreurLogoClientInvalide } from '@/lib/organisateur/logo-client';
import { prisma } from '@/lib/prisma';
import type { EtatFormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';

// Le logo client n'est plus soumis avec ce formulaire (édition) : il a son
// propre widget indépendant sur la page Modifier (televerserLogoClientAction
// ci-dessous), au même titre que le logo cabinet sur l'écran Équipe — un
// nouveau logo est donc immédiatement remplacé sans passer par
// "Enregistrer les modifications". Le champ ne reste que dans le formulaire
// de CRÉATION, où aucun widget indépendant n'est possible (pas encore de
// seminaireId).
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

export interface EtatUploadLogoClient {
  erreur?: string;
}

export async function televerserLogoClientAction(
  seminaireId: string,
  _etatPrecedent: EtatUploadLogoClient,
  formData: FormData,
): Promise<EtatUploadLogoClient> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = formData.get('logoClient');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez un fichier.' };
  }

  const erreurValidation = erreurLogoClientInvalide(fichier.type, fichier.size);
  if (erreurValidation) return { erreur: erreurValidation };

  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId: contexte.cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!seminaire) return { erreur: 'Séminaire introuvable.' };

  const contenu = Buffer.from(await fichier.arrayBuffer());
  await enregistrerLogoClient(seminaireId, fichier.name, contenu);

  revalidatePath(`/organisateur/seminaires/${seminaireId}/modifier`);
  return {};
}
