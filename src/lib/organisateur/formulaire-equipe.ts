import { normaliserEmail, normaliserNom } from '../normalisation';
import type { DonneesFormateur } from './equipe';

export interface ResultatAnalyseFormulaireFormateur {
  donnees?: DonneesFormateur;
  erreur?: string;
}

// Volontairement simple (pas de lib externe) : un contrôle de forme, pas de
// vérification de délivrabilité — cohérent avec normaliserEmail (lib/
// normalisation.ts), qui ne fait que trim/lowercase sans valider le format.
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validation pure (aucun accès DB, testable sans base — même philosophie que
 * formulaire-seminaire.ts/formulaire-participant.ts). Contrairement au
 * participant, l'email est ici obligatoire : un formateur ne se connecte
 * jamais (son accès est le lien direct /f/{codeFormateur} par séminaire, voir
 * lib/formateur-lien.ts) mais reste identifié par son adresse, seul moyen de
 * le contacter hors de la plateforme.
 */
export function analyserFormulaireFormateur(formData: FormData): ResultatAnalyseFormulaireFormateur {
  const nom = normaliserNom(String(formData.get('nom') ?? ''));
  const prenom = normaliserNom(String(formData.get('prenom') ?? ''));
  if (!nom || !prenom) return { erreur: 'Le nom et le prénom sont obligatoires.' };

  const email = normaliserEmail(String(formData.get('email') ?? ''));
  if (!email || !FORMAT_EMAIL.test(email)) {
    return { erreur: 'Un e-mail valide est obligatoire pour identifier ce formateur.' };
  }

  return { donnees: { nom, prenom, email } };
}
