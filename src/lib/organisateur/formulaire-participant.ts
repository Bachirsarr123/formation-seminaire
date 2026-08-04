import { normaliserEmail, normaliserNom, normaliserTelephone } from '../normalisation';
import type { DonneesParticipantManuel } from './participants';

export interface ResultatAnalyseFormulaireParticipant {
  donnees?: DonneesParticipantManuel;
  erreur?: string;
}

/**
 * Validation pure (aucun accès DB, testable sans base — même philosophie
 * que formulaire-seminaire.ts). Rejette avant tout appel à
 * trouverOuCreerParticipant() les cas qui violeraient la contrainte CHECK
 * de la table participant (email IS NOT NULL OR telephone IS NOT NULL) :
 * sans ce contrôle ici, un téléphone invalide silencieusement normalisé à
 * null par normaliserTelephone() ferait remonter une erreur Postgres brute
 * à l'organisateur plutôt qu'un message clair.
 */
export function analyserFormulaireParticipant(formData: FormData): ResultatAnalyseFormulaireParticipant {
  const nom = normaliserNom(String(formData.get('nom') ?? ''));
  const prenom = normaliserNom(String(formData.get('prenom') ?? ''));
  if (!nom || !prenom) return { erreur: 'Le nom et le prénom sont obligatoires.' };

  const telephoneBrut = String(formData.get('telephone') ?? '').trim();
  const email = normaliserEmail(String(formData.get('email') ?? ''));
  const telephone = normaliserTelephone(telephoneBrut);

  if (!email && !telephone) {
    return {
      erreur: telephoneBrut
        ? "Le numéro de téléphone saisi est invalide, et aucun e-mail n'a été renseigné."
        : 'Un e-mail ou un numéro de téléphone est obligatoire.',
    };
  }

  return {
    donnees: {
      nom,
      prenom,
      email,
      telephone,
      fonction: String(formData.get('fonction') ?? '').trim() || null,
      organisation: String(formData.get('organisation') ?? '').trim() || null,
    },
  };
}
