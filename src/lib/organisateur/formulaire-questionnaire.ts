import type { DonneesModele } from './questionnaires';

export interface ResultatAnalyseFormulaireModele {
  donnees?: DonneesModele;
  erreur?: string;
}

/**
 * Validation pure (aucun accès DB), même philosophie que
 * formulaire-seminaire.ts/formulaire-equipe.ts. `nom` (bibliothèque) et
 * `titre` (vu par les participants une fois publié) sont deux champs
 * distincts du schéma — voir le commentaire sur Questionnaire.nom.
 */
export function analyserFormulaireModele(formData: FormData): ResultatAnalyseFormulaireModele {
  const nom = String(formData.get('nom') ?? '').trim();
  if (!nom) return { erreur: 'Le nom du modèle est obligatoire.' };

  const titre = String(formData.get('titre') ?? '').trim();
  if (!titre) return { erreur: 'Le titre est obligatoire.' };

  return { donnees: { nom, titre } };
}
