import { normaliserEmail, normaliserNom } from '../normalisation';
import type { DonneesFormateur, DonneesModificationMembre, DonneesOrganisateur } from './equipe';

// Volontairement simple (pas de lib externe) : un contrôle de forme, pas de
// vérification de délivrabilité — cohérent avec normaliserEmail (lib/
// normalisation.ts), qui ne fait que trim/lowercase sans valider le format.
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Même plancher que la réinitialisation de mot de passe
// (connexion/reinitialiser/[jeton]/actions.ts) et le script d'initialisation
// de production — un seul chiffre à faire évoluer si la politique change.
const LONGUEUR_MOT_DE_PASSE_MINIMALE = 12;

function analyserNomPrenomEmail(formData: FormData): { nom: string; prenom: string; email: string } | { erreur: string } {
  const nom = normaliserNom(String(formData.get('nom') ?? ''));
  const prenom = normaliserNom(String(formData.get('prenom') ?? ''));
  if (!nom || !prenom) return { erreur: 'Le nom et le prénom sont obligatoires.' };

  const email = normaliserEmail(String(formData.get('email') ?? ''));
  if (!email || !FORMAT_EMAIL.test(email)) {
    return { erreur: 'Un e-mail valide est obligatoire.' };
  }

  return { nom, prenom, email };
}

export interface ResultatAnalyseFormulaireFormateur {
  donnees?: DonneesFormateur;
  erreur?: string;
}

/**
 * Validation pure (aucun accès DB, testable sans base — même philosophie que
 * formulaire-seminaire.ts/formulaire-participant.ts). Contrairement au
 * participant, l'email est ici obligatoire : un formateur ne se connecte
 * jamais (son accès est le lien direct /f/{codeFormateur} par séminaire, voir
 * lib/formateur-lien.ts) mais reste identifié par son adresse, seul moyen de
 * le contacter hors de la plateforme.
 */
export function analyserFormulaireFormateur(formData: FormData): ResultatAnalyseFormulaireFormateur {
  const resultat = analyserNomPrenomEmail(formData);
  if ('erreur' in resultat) return { erreur: resultat.erreur };
  return { donnees: resultat };
}

export interface ResultatAnalyseFormulaireOrganisateur {
  donnees?: DonneesOrganisateur;
  erreur?: string;
}

/**
 * Contrairement au formateur, un organisateur se connecte : un mot de passe
 * est obligatoire à la création, avec la même politique (longueur minimale,
 * confirmation) que le flux de réinitialisation.
 */
export function analyserFormulaireOrganisateur(formData: FormData): ResultatAnalyseFormulaireOrganisateur {
  const resultat = analyserNomPrenomEmail(formData);
  if ('erreur' in resultat) return { erreur: resultat.erreur };

  const motDePasse = String(formData.get('motDePasse') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MINIMALE) {
    return { erreur: `Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MINIMALE} caractères.` };
  }
  if (motDePasse !== confirmation) {
    return { erreur: 'Les deux mots de passe ne correspondent pas.' };
  }

  return { donnees: { ...resultat, motDePasse } };
}

export interface ResultatAnalyseFormulaireModification {
  donnees?: DonneesModificationMembre;
  erreur?: string;
}

/** Modification de fiche (nom/prénom/e-mail) — même règle de forme que la création, quel que soit le rôle. */
export function analyserFormulaireModification(formData: FormData): ResultatAnalyseFormulaireModification {
  const resultat = analyserNomPrenomEmail(formData);
  if ('erreur' in resultat) return { erreur: resultat.erreur };
  return { donnees: resultat };
}
