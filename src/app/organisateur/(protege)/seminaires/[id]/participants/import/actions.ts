'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import {
  ApercuImportIntrouvableError,
  CapaciteImportInsuffisanteError,
  PLAFOND_TAILLE_OCTETS,
  confirmerImportCsv,
  previsualiserImportCsv,
  type RapportPreviewImport,
} from '@/lib/organisateur/import-participants';

// Réservées à l'organisateur (rôle vérifié explicitement, jamais seulement
// la session) — même garde que le reste des actions de gestion des
// participants (lot 4, étape 6).

export interface EtatPreviewImport {
  rapport?: RapportPreviewImport;
  erreurGlobale?: string;
}

export async function previsualiserImportAction(
  seminaireId: string,
  _etatPrecedent: EtatPreviewImport,
  formData: FormData,
): Promise<EtatPreviewImport> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const fichier = formData.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreurGlobale: 'Sélectionnez un fichier CSV.' };
  }
  // Vérifié sur file.size avant de lire le moindre octet — inutile de
  // charger un fichier hors gabarit en mémoire pour le rejeter ensuite.
  if (fichier.size > PLAFOND_TAILLE_OCTETS) {
    return {
      erreurGlobale: `Le fichier dépasse la taille maximale autorisée (${Math.floor(PLAFOND_TAILLE_OCTETS / 1024)} Ko).`,
    };
  }

  const buffer = Buffer.from(await fichier.arrayBuffer());
  const resultat = await previsualiserImportCsv(contexte.cabinetId, seminaireId, contexte.utilisateurId, buffer);

  if (resultat === null) return { erreurGlobale: 'Séminaire introuvable.' };
  if ('erreurGlobale' in resultat) return resultat;

  return { rapport: resultat };
}

export interface EtatConfirmationImport {
  succes?: boolean;
  importes?: number;
  dejaInscrits?: number;
  erreur?: string;
}

export async function confirmerImportAction(
  seminaireId: string,
  _etatPrecedent: EtatConfirmationImport,
  formData: FormData,
): Promise<EtatConfirmationImport> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  // Seul champ transmis : aucune donnée personnelle en hidden field
  // (décision 2 de l'étape 7) — la confirmation relit l'aperçu côté serveur.
  const apercuId = String(formData.get('apercuId') ?? '');
  if (!apercuId) return { erreur: "Aperçu manquant : veuillez réimporter le fichier." };

  try {
    const resultat = await confirmerImportCsv(contexte.cabinetId, seminaireId, contexte.utilisateurId, apercuId);
    if (!resultat) return { erreur: 'Séminaire introuvable.' };

    revalidatePath(`/organisateur/seminaires/${seminaireId}/participants`);
    return { succes: true, importes: resultat.importes, dejaInscrits: resultat.dejaInscrits };
  } catch (e) {
    if (e instanceof ApercuImportIntrouvableError || e instanceof CapaciteImportInsuffisanteError) {
      return { erreur: e.message };
    }
    throw e;
  }
}
