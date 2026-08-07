import type { Prisma, TypeRecueilQuestion } from '@prisma/client';
import { avecAutreRecueil, choixRecueil } from './options';

export interface RecueilQuestionPourValidation {
  id: string;
  type: TypeRecueilQuestion;
  options: Prisma.JsonValue | null;
}

/** Nom de champ partagé entre le rendu du formulaire et l'analyse de FormData — source unique. */
export function nomChampRecueilQuestion(questionId: string): string {
  return `recueil-question-${questionId}`;
}

// Nom de champ du texte libre associé à la case « Autre » d'une question
// CHOIX_MULTIPLE — distinct du nom de champ des cases à cocher elles-mêmes.
export function nomChampRecueilAutre(questionId: string): string {
  return `${nomChampRecueilQuestion(questionId)}-autre`;
}

const VALEUR_AUTRE = '__autre__';
const LIMITE_TEXTE_LIBRE = 5000;
const LIMITE_TEXTE_AUTRE = 500;

/**
 * Aucune question n'est obligatoire dans un recueil (contrainte du lot,
 * contrairement au questionnaire d'évaluation) : une réponse absente est
 * simplement omise de l'objet `reponses`, jamais une erreur. Rejoue,
 * exactement comme validation-reponses.ts (questionnaire), le FormData reçu
 * contre la structure réelle chargée en base — jamais une structure envoyée
 * par le client.
 */
export function analyserReponsesRecueil(
  questions: RecueilQuestionPourValidation[],
  formData: FormData,
): Record<string, string | string[]> {
  const reponses: Record<string, string | string[]> = {};

  for (const question of questions) {
    const champ = nomChampRecueilQuestion(question.id);

    if (question.type === 'TEXTE_LIBRE') {
      const brut = formData.get(champ);
      const texte = typeof brut === 'string' ? brut.trim().slice(0, LIMITE_TEXTE_LIBRE) : '';
      if (texte !== '') reponses[question.id] = texte;
      continue;
    }

    // CHOIX_UNIQUE / CHOIX_MULTIPLE
    const idsValides = new Set(choixRecueil(question.options).map((c) => c.id));
    const bruts = formData.getAll(champ).map(String).filter((v) => v !== '');
    const valeurs = bruts.filter((v) => v !== VALEUR_AUTRE && idsValides.has(v));

    if (question.type === 'CHOIX_MULTIPLE' && avecAutreRecueil(question.options) && bruts.includes(VALEUR_AUTRE)) {
      const texteAutre = String(formData.get(nomChampRecueilAutre(question.id)) ?? '').trim().slice(0, LIMITE_TEXTE_AUTRE);
      if (texteAutre !== '') valeurs.push(texteAutre);
    }

    if (valeurs.length === 0) continue;

    if (question.type === 'CHOIX_UNIQUE') {
      reponses[question.id] = valeurs[0]!;
    } else {
      reponses[question.id] = valeurs;
    }
  }

  return reponses;
}

export { VALEUR_AUTRE };
