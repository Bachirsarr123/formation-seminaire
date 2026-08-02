import type { Prisma, TypeQuestion } from '@prisma/client';
import {
  BORNES_ECHELLE,
  MARQUEUR_SANS_OPINION,
  VALEUR_FORMULAIRE_SANS_OPINION,
  choixQcm,
  estTypeEchelle,
} from './echelles';

export interface QuestionPourValidation {
  id: string;
  type: TypeQuestion;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  options: Prisma.JsonValue | null;
}

export interface ReponseAnalysee {
  questionId: string;
  valeurNumerique?: number;
  valeurTexte?: string;
  valeurOptions?: Prisma.InputJsonValue;
}

export interface ErreurValidationReponse {
  questionId: string;
  message: string;
}

export interface ResultatAnalyseReponses {
  reponses: ReponseAnalysee[];
  erreurs: ErreurValidationReponse[];
}

/** Nom de champ partagé entre le rendu du formulaire et l'analyse de FormData — source unique. */
export function nomChampQuestion(questionId: string): string {
  return `question-${questionId}`;
}

const LIMITE_TEXTE_LIBRE = 5000;

/**
 * Rejoue, côté serveur, exactement ce que le navigateur a soumis (avec ou
 * sans JavaScript) : lit `FormData` question par question à partir de la
 * structure réelle du questionnaire chargée en base — jamais depuis une
 * structure envoyée par le client. Ne fait confiance à aucune valeur reçue :
 * bornes, appartenance aux options déclarées et statut obligatoire sont
 * revérifiés ici, y compris pour un POST forgé à la main.
 */
export function analyserReponsesFormulaire(
  questions: QuestionPourValidation[],
  formData: FormData,
): ResultatAnalyseReponses {
  const reponses: ReponseAnalysee[] = [];
  const erreurs: ErreurValidationReponse[] = [];

  for (const question of questions) {
    const champ = nomChampQuestion(question.id);

    if (estTypeEchelle(question.type)) {
      const brut = formData.get(champ);
      if (brut === null || brut === '') {
        if (question.obligatoire) erreurs.push({ questionId: question.id, message: 'Réponse requise.' });
        continue;
      }
      if (brut === VALEUR_FORMULAIRE_SANS_OPINION) {
        if (!question.autoriseSansOpinion) {
          erreurs.push({ questionId: question.id, message: 'Réponse invalide.' });
          continue;
        }
        reponses.push({ questionId: question.id, valeurOptions: MARQUEUR_SANS_OPINION });
        continue;
      }
      const { min, max } = BORNES_ECHELLE[question.type];
      const valeur = Number(brut);
      if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
        erreurs.push({ questionId: question.id, message: 'Réponse invalide.' });
        continue;
      }
      reponses.push({ questionId: question.id, valeurNumerique: valeur });
      continue;
    }

    if (question.type === 'OUI_NON') {
      const brut = formData.get(champ);
      if (brut === null || brut === '') {
        if (question.obligatoire) erreurs.push({ questionId: question.id, message: 'Réponse requise.' });
        continue;
      }
      if (brut !== '0' && brut !== '1') {
        erreurs.push({ questionId: question.id, message: 'Réponse invalide.' });
        continue;
      }
      reponses.push({ questionId: question.id, valeurNumerique: Number(brut) });
      continue;
    }

    if (question.type === 'QCM_UNIQUE' || question.type === 'QCM_MULTIPLE') {
      const idsValides = new Set(choixQcm(question.options).map((c) => c.id));
      const bruts = formData.getAll(champ).map(String).filter((v) => v !== '');
      if (bruts.length === 0) {
        if (question.obligatoire) erreurs.push({ questionId: question.id, message: 'Réponse requise.' });
        continue;
      }
      if (question.type === 'QCM_UNIQUE' && bruts.length > 1) {
        erreurs.push({ questionId: question.id, message: 'Réponse invalide.' });
        continue;
      }
      if (!bruts.every((id) => idsValides.has(id))) {
        erreurs.push({ questionId: question.id, message: 'Réponse invalide.' });
        continue;
      }
      reponses.push({ questionId: question.id, valeurOptions: { choix: bruts } });
      continue;
    }

    // TEXTE_LIBRE
    const brut = formData.get(champ);
    const texte = typeof brut === 'string' ? brut.trim() : '';
    if (texte === '') {
      if (question.obligatoire) erreurs.push({ questionId: question.id, message: 'Réponse requise.' });
      continue;
    }
    if (texte.length > LIMITE_TEXTE_LIBRE) {
      erreurs.push({ questionId: question.id, message: `${LIMITE_TEXTE_LIBRE} caractères maximum.` });
      continue;
    }
    reponses.push({ questionId: question.id, valeurTexte: texte });
  }

  return { reponses, erreurs };
}
