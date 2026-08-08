'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import {
  ajouterSupport,
  basculerVisibiliteSupport,
  deplacerSupport,
  supprimerSupportLogiquement,
} from '@/lib/organisateur/supports';
import type { Direction } from '@/lib/questionnaire/editeur';

// Réservées aux organisateurs (rôle vérifié explicitement) — même discipline
// que l'import CSV/la bibliothèque de modèles : gestion administrative du
// séminaire, jamais déléguée au formateur (lecture seule ailleurs dans
// l'espace organisateur).

export interface EtatUploadSupport {
  erreur?: string;
}

export async function ajouterSupportAction(
  seminaireId: string,
  _etatPrecedent: EtatUploadSupport,
  formData: FormData,
): Promise<EtatUploadSupport> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = formData.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez un fichier.' };
  }
  // Vérifié sur file.size avant de lire le moindre octet — inutile de
  // charger un fichier hors gabarit en mémoire (et sur disque) pour le
  // rejeter ensuite ; ajouterSupport revérifie de toute façon la taille
  // réelle du buffer, cette vérification-ci n'est qu'un filtre rapide.
  const PLAFOND_OCTETS = 10 * 1024 * 1024;
  if (fichier.size > PLAFOND_OCTETS) {
    return { erreur: `Le fichier dépasse la taille maximale autorisée (${PLAFOND_OCTETS / (1024 * 1024)} Mo).` };
  }

  const titre = String(formData.get('titre') ?? '').trim();
  const contenu = Buffer.from(await fichier.arrayBuffer());

  const resultat = await ajouterSupport(contexte.cabinetId, seminaireId, {
    titre: titre || fichier.name,
    nomFichier: fichier.name,
    typeMime: fichier.type,
    contenu,
  });
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/organisateur/seminaires/${seminaireId}/supports`);
  return {};
}

export async function supprimerSupportAction(seminaireId: string, supportId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await supprimerSupportLogiquement(contexte.cabinetId, seminaireId, supportId);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/supports`);
}

export async function deplacerSupportAction(seminaireId: string, supportId: string, direction: Direction): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await deplacerSupport(contexte.cabinetId, seminaireId, supportId, direction);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/supports`);
}

export async function basculerVisibiliteAction(seminaireId: string, supportId: string, visible: boolean): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await basculerVisibiliteSupport(contexte.cabinetId, seminaireId, supportId, visible);
  revalidatePath(`/organisateur/seminaires/${seminaireId}/supports`);
}
