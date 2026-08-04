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
 * participant, l'email est ici obligatoire : un formateur n'a pas de mot de
 * passe et se connecte uniquement par lien magique envoyé à cette adresse
 * (lib/organisateur/lien-magique-formateur.ts) — sans email, le compte créé
 * serait inutilisable.
 */
export function analyserFormulaireFormateur(formData: FormData): ResultatAnalyseFormulaireFormateur {
  const nom = normaliserNom(String(formData.get('nom') ?? ''));
  const prenom = normaliserNom(String(formData.get('prenom') ?? ''));
  if (!nom || !prenom) return { erreur: 'Le nom et le prénom sont obligatoires.' };

  const email = normaliserEmail(String(formData.get('email') ?? ''));
  if (!email || !FORMAT_EMAIL.test(email)) {
    return { erreur: "Un e-mail valide est obligatoire : c'est la seule façon pour ce formateur de se connecter." };
  }

  return { donnees: { nom, prenom, email } };
}
