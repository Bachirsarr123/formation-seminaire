import { Prisma, TypeQuestion } from '@prisma/client';
import type { DonneesQuestion, DonneesSection } from '../questionnaire/editeur';

export interface ResultatAnalyseFormulaireSection {
  donnees?: DonneesSection;
  erreur?: string;
}

export function analyserFormulaireSection(formData: FormData): ResultatAnalyseFormulaireSection {
  const titre = String(formData.get('titre') ?? '').trim();
  if (!titre) return { erreur: 'Le titre de la section est obligatoire.' };

  const description = String(formData.get('description') ?? '').trim() || null;
  return { donnees: { titre, description } };
}

export interface ResultatAnalyseFormulaireQuestion {
  donnees?: DonneesQuestion;
  erreur?: string;
}

const TYPES_VALIDES: readonly string[] = Object.values(TypeQuestion);
// Nombre fixe d'emplacements de choix QCM (plutôt qu'un ajout dynamique de
// lignes, qui dépendrait de JavaScript) : suffisant en pratique, les vides
// sont ignorés.
const NB_CHOIX_QCM = 8;
const NIVEAUX_ECHELLE_4 = ['1', '2', '3', '4'] as const;

/**
 * Validation pure (aucun accès DB), même philosophie que
 * formulaire-seminaire.ts. Un seul formulaire pour tous les types de
 * question : les champs propres à un type (choix QCM, niveaux d'échelle)
 * sont toujours présents dans le HTML, jamais affichés/masqués par JS —
 * cette fonction ne lit que le bloc pertinent pour le `type` soumis.
 */
export function analyserFormulaireQuestion(formData: FormData): ResultatAnalyseFormulaireQuestion {
  const intitule = String(formData.get('intitule') ?? '').trim();
  if (!intitule) return { erreur: "L'intitulé est obligatoire." };

  const type = String(formData.get('type') ?? '');
  if (!TYPES_VALIDES.includes(type)) return { erreur: 'Type de question invalide.' };

  const description = String(formData.get('description') ?? '').trim() || null;
  const obligatoire = formData.get('obligatoire') === 'on';
  const autoriseSansOpinion = formData.get('autoriseSansOpinion') === 'on';
  const moduleId = String(formData.get('moduleId') ?? '').trim() || null;

  let options: Prisma.InputJsonValue | null = null;

  if (type === 'QCM_UNIQUE' || type === 'QCM_MULTIPLE') {
    const choix: { id: string; libelle: string }[] = [];
    for (let i = 1; i <= NB_CHOIX_QCM; i++) {
      const libelle = String(formData.get(`choixLibelle${i}`) ?? '').trim();
      if (libelle) choix.push({ id: `opt-${i}`, libelle });
    }
    if (choix.length < 2) return { erreur: 'Un QCM nécessite au moins deux choix renseignés.' };
    options = { choix };
  }

  if (type === 'ECHELLE_4') {
    const libelles: Record<string, string> = {};
    for (const niveau of NIVEAUX_ECHELLE_4) {
      const libelle = String(formData.get(`echelleLibelle${niveau}`) ?? '').trim();
      if (!libelle) return { erreur: "Les 4 niveaux de l'échelle doivent tous être renseignés." };
      libelles[niveau] = libelle;
    }
    options = { libelles };
  }

  return {
    donnees: {
      intitule,
      description,
      type: type as TypeQuestion,
      obligatoire,
      autoriseSansOpinion,
      moduleId,
      options,
    },
  };
}
