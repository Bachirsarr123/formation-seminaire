'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { StatutSeminaire } from '@prisma/client';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import {
  TransitionStatutInvalideError,
  changerStatutSeminaire,
  dupliquerSeminaire,
  supprimerSeminaireLogiquement,
} from '@/lib/organisateur/seminaires';

// Toutes les actions ci-dessous sont réservées aux organisateurs (rôle
// vérifié explicitement, jamais seulement la session) : un formateur est en
// lecture seule.

export async function dupliquerSeminaireAction(seminaireId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const copie = await dupliquerSeminaire(contexte.cabinetId, seminaireId);
  if (!copie) return; // séminaire introuvable/autre cabinet : rien à faire, pas d'indice donné

  redirect(`/organisateur/seminaires/${copie.id}/modifier`);
}

export async function supprimerSeminaireAction(seminaireId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await supprimerSeminaireLogiquement(contexte.cabinetId, seminaireId);
  redirect('/organisateur/seminaires');
}

export interface EtatChangementStatut {
  erreur?: string;
}

export async function changerStatutSeminaireAction(
  seminaireId: string,
  _etatPrecedent: EtatChangementStatut,
  formData: FormData,
): Promise<EtatChangementStatut> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const statutCible = String(formData.get('statut') ?? '');

  if (!(statutCible in StatutSeminaire)) return { erreur: 'Statut invalide.' };

  try {
    await changerStatutSeminaire(contexte.cabinetId, seminaireId, statutCible as StatutSeminaire);
  } catch (erreur) {
    if (erreur instanceof TransitionStatutInvalideError) return { erreur: erreur.message };
    throw erreur;
  }

  revalidatePath(`/organisateur/seminaires/${seminaireId}`);
  return {};
}
