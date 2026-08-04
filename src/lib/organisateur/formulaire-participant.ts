import { normaliserEmail, normaliserNom, normaliserTelephone } from '../normalisation';
import type { DonneesParticipantManuel } from './participants';

export interface ResultatAnalyseFormulaireParticipant {
  donnees?: DonneesParticipantManuel;
  erreur?: string;
}

export interface ChampsParticipantBruts {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  fonction: string;
  organisation: string;
}

/**
 * Validation pure (aucun accès DB, testable sans base — même philosophie
 * que formulaire-seminaire.ts). Rejette avant tout appel à
 * trouverOuCreerParticipant() les cas qui violeraient la contrainte CHECK
 * de la table participant (email IS NOT NULL OR telephone IS NOT NULL) :
 * sans ce contrôle ici, un téléphone invalide silencieusement normalisé à
 * null par normaliserTelephone() ferait remonter une erreur Postgres brute
 * à l'organisateur plutôt qu'un message clair.
 *
 * Prend des chaînes brutes plutôt qu'un FormData pour être réutilisable par
 * la validation ligne par ligne de l'import CSV (lot 4, étape 7) — même
 * règle "nom/prénom obligatoires, email OU téléphone valide obligatoire"
 * des deux côtés, une seule implémentation.
 */
export function validerChampsParticipant(champs: ChampsParticipantBruts): ResultatAnalyseFormulaireParticipant {
  const nom = normaliserNom(champs.nom);
  const prenom = normaliserNom(champs.prenom);
  if (!nom || !prenom) return { erreur: 'Le nom et le prénom sont obligatoires.' };

  const telephoneBrut = champs.telephone.trim();
  const email = normaliserEmail(champs.email);
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
      fonction: champs.fonction.trim() || null,
      organisation: champs.organisation.trim() || null,
    },
  };
}

export function analyserFormulaireParticipant(formData: FormData): ResultatAnalyseFormulaireParticipant {
  return validerChampsParticipant({
    nom: String(formData.get('nom') ?? ''),
    prenom: String(formData.get('prenom') ?? ''),
    email: String(formData.get('email') ?? ''),
    telephone: String(formData.get('telephone') ?? ''),
    fonction: String(formData.get('fonction') ?? ''),
    organisation: String(formData.get('organisation') ?? ''),
  });
}
