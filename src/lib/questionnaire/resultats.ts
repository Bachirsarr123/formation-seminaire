import 'server-only';
import type { Prisma, TypeQuestion } from '@prisma/client';
import { prisma } from '../prisma';
import { melangerAleatoirement } from '../anonymat';
import { BORNES_ECHELLE, choixQcm, estMarqueurSansOpinion, estTypeEchelle, libellesEchelle4, type TypeEchelle } from './echelles';

/**
 * Zone cloisonnée au même titre que Soumission/Reponse (Règle 2) : tout ce
 * fichier lit exclusivement Questionnaire → Section → Question → Reponse,
 * jamais Inscription ni Participant. `calculerResultatsQuestionnaire` ne
 * prend QU'UN SEUL paramètre — délibérément : aucun filtre (organisation,
 * fonction, date...) ne doit jamais s'ajouter à sa signature (Règle « aucun
 * filtre croisé »), voir tests/integration/resultats-anonymat.test.ts qui
 * vérifie l'arité de la fonction comme garde-fou de régression.
 */

export interface DistributionValeur {
  valeur: string;
  libelle: string;
  nombre: number;
  pourcentage: number;
}

export interface ResultatQuestionFermee {
  questionId: string;
  intitule: string;
  description: string | null;
  type: TypeQuestion;
  moduleId: string | null;
  moyenne: number | null;
  // Moyenne ramenée sur 0-100, bornes propres au type de question (ex.
  // NOTE_10 min 1/max 10, OUI_NON min 0/max 1) — permet de comparer entre
  // elles des questions notées sur des échelles différentes (diagramme
  // récapitulatif, en bas de la page résultats). `null` pour QCM (pas de
  // moyenne : des choix non ordonnés n'ont pas de bornes numériques).
  moyennePourcentage: number | null;
  distribution: DistributionValeur[];
  sansOpinion: number;
  nbReponses: number;
}

export interface ResultatQuestionOuverte {
  questionId: string;
  intitule: string;
  description: string | null;
  moduleId: string | null;
  // Mélangées (Règle « pas d'ordre ») — jamais de date, jamais de numéro
  // d'ordre associé à chaque texte : la forme même de ce type (string[], pas
  // un tableau d'objets) rend structurellement impossible d'y attacher l'un
  // ou l'autre par erreur plus tard.
  reponses: string[];
  total: number;
}

export interface ResultatModule {
  moduleId: string;
  titre: string;
  moyenne: number;
}

export interface ResultatsQuestionnaire {
  totalSoumissions: number;
  questionsFermees: ResultatQuestionFermee[];
  questionsOuvertes: ResultatQuestionOuverte[];
  modules: ResultatModule[];
  moyenneGlobale: number | null;
}

interface ReponseFermeeBrute {
  valeurNumerique: number | null;
  valeurOptions: Prisma.JsonValue | null;
}

function bornesQuestion(type: TypeQuestion): { min: number; max: number } | null {
  if (type === 'OUI_NON') return { min: 0, max: 1 };
  if (estTypeEchelle(type)) return BORNES_ECHELLE[type as TypeEchelle];
  return null;
}

function libelleValeurNumerique(type: TypeQuestion, valeur: number, options: unknown): string {
  if (type === 'OUI_NON') return valeur === 1 ? 'Oui' : 'Non';
  if (type === 'ECHELLE_4') {
    const libelles = libellesEchelle4(options);
    return libelles?.[String(valeur) as '1' | '2' | '3' | '4'] ?? String(valeur);
  }
  return String(valeur);
}

/**
 * Calcule moyenne + distribution pour une question à valeur numérique
 * (NOTE_5, NOTE_10, ECHELLE_4, NPS, OUI_NON) — jamais pour QCM/TEXTE_LIBRE,
 * traitées séparément ci-dessous. « Sans opinion » (marqueur dans
 * valeurOptions, valeurNumerique null) compte à part, jamais dans la moyenne
 * ni le dénominateur des pourcentages de distribution.
 */
function agregerQuestionNumerique(
  type: TypeQuestion,
  options: unknown,
  reponses: ReponseFermeeBrute[],
): Pick<ResultatQuestionFermee, 'moyenne' | 'moyennePourcentage' | 'distribution' | 'sansOpinion' | 'nbReponses'> {
  const bornes = bornesQuestion(type);
  if (!bornes) return { moyenne: null, moyennePourcentage: null, distribution: [], sansOpinion: 0, nbReponses: 0 };

  let sansOpinion = 0;
  const valeurs: number[] = [];
  for (const r of reponses) {
    if (estMarqueurSansOpinion(r.valeurOptions)) {
      sansOpinion += 1;
      continue;
    }
    if (r.valeurNumerique !== null) valeurs.push(r.valeurNumerique);
  }

  const compteurs = new Map<number, number>();
  for (let v = bornes.min; v <= bornes.max; v++) compteurs.set(v, 0);
  for (const v of valeurs) compteurs.set(v, (compteurs.get(v) ?? 0) + 1);

  const distribution: DistributionValeur[] = Array.from(compteurs.entries()).map(([valeur, nombre]) => ({
    valeur: String(valeur),
    libelle: libelleValeurNumerique(type, valeur, options),
    nombre,
    pourcentage: valeurs.length > 0 ? Math.round((nombre / valeurs.length) * 100) : 0,
  }));

  const moyenne = valeurs.length > 0 ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
  const moyennePourcentage =
    moyenne !== null ? Math.round(((moyenne - bornes.min) / (bornes.max - bornes.min)) * 100) : null;

  return { moyenne, moyennePourcentage, distribution, sansOpinion, nbReponses: valeurs.length };
}

/** QCM_UNIQUE/QCM_MULTIPLE : pas de moyenne (choix non ordonnés), distribution en % des répondants (pas des choix — une personne peut cocher plusieurs cases en CHOIX_MULTIPLE). */
function agregerQuestionQcm(
  options: unknown,
  reponses: ReponseFermeeBrute[],
): Pick<ResultatQuestionFermee, 'moyenne' | 'moyennePourcentage' | 'distribution' | 'sansOpinion' | 'nbReponses'> {
  const choix = choixQcm(options);
  const compteurs = new Map(choix.map((c) => [c.id, 0]));
  let nbRepondants = 0;

  for (const r of reponses) {
    const valeurOptions = r.valeurOptions as { choix?: unknown } | null;
    const ids = Array.isArray(valeurOptions?.choix) ? (valeurOptions!.choix as string[]) : [];
    if (ids.length === 0) continue;
    nbRepondants += 1;
    for (const id of ids) {
      if (compteurs.has(id)) compteurs.set(id, (compteurs.get(id) ?? 0) + 1);
    }
  }

  const distribution: DistributionValeur[] = choix.map((c) => ({
    valeur: c.id,
    libelle: c.libelle,
    nombre: compteurs.get(c.id) ?? 0,
    pourcentage: nbRepondants > 0 ? Math.round(((compteurs.get(c.id) ?? 0) / nbRepondants) * 100) : 0,
  }));

  return { moyenne: null, moyennePourcentage: null, distribution, sansOpinion: 0, nbReponses: nbRepondants };
}

export async function calculerResultatsQuestionnaire(questionnaireId: string): Promise<ResultatsQuestionnaire> {
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: questionnaireId },
    select: {
      sections: {
        orderBy: { ordre: 'asc' },
        select: {
          questions: {
            where: { supprimeLe: null },
            orderBy: { ordre: 'asc' },
            select: {
              id: true,
              intitule: true,
              description: true,
              type: true,
              options: true,
              moduleId: true,
              module: { select: { titre: true } },
            },
          },
        },
      },
    },
  });

  const totalSoumissions = await prisma.soumission.count({ where: { questionnaireId } });

  const toutesQuestions = questionnaire.sections.flatMap((s) => s.questions);
  const questionsFermees: ResultatQuestionFermee[] = [];
  const questionsOuvertes: ResultatQuestionOuverte[] = [];

  for (const question of toutesQuestions) {
    if (question.type === 'TEXTE_LIBRE') {
      const reponses = await prisma.reponse.findMany({
        where: { questionId: question.id },
        select: { valeurTexte: true },
      });
      const textes = reponses.map((r) => r.valeurTexte).filter((t): t is string => t !== null && t !== '');

      questionsOuvertes.push({
        questionId: question.id,
        intitule: question.intitule,
        description: question.description,
        moduleId: question.moduleId,
        reponses: melangerAleatoirement(textes),
        total: textes.length,
      });
      continue;
    }

    const reponses = await prisma.reponse.findMany({
      where: { questionId: question.id },
      select: { valeurNumerique: true, valeurOptions: true },
    });

    const agrege =
      question.type === 'QCM_UNIQUE' || question.type === 'QCM_MULTIPLE'
        ? agregerQuestionQcm(question.options, reponses)
        : agregerQuestionNumerique(question.type, question.options, reponses);

    questionsFermees.push({
      questionId: question.id,
      intitule: question.intitule,
      description: question.description,
      type: question.type,
      moduleId: question.moduleId,
      ...agrege,
    });
  }

  // Moyenne par module : moyenne des moyennes de question (chaque question
  // pèse pour une part égale, indépendamment de son nombre de répondants) —
  // seules les questions à moyenne définie (numériques) y contribuent.
  const parModule = new Map<string, { titre: string; moyennes: number[] }>();
  for (const q of questionsFermees) {
    if (!q.moduleId || q.moyenne === null) continue;
    const titre = toutesQuestions.find((tq) => tq.id === q.questionId)?.module?.titre ?? '';
    const entree = parModule.get(q.moduleId) ?? { titre, moyennes: [] };
    entree.moyennes.push(q.moyenne);
    parModule.set(q.moduleId, entree);
  }
  const modules: ResultatModule[] = Array.from(parModule.entries()).map(([moduleId, { titre, moyennes }]) => ({
    moduleId,
    titre,
    moyenne: moyennes.reduce((a, b) => a + b, 0) / moyennes.length,
  }));

  const moyennesQuestions = questionsFermees.map((q) => q.moyenne).filter((m): m is number => m !== null);
  const moyenneGlobale =
    moyennesQuestions.length > 0 ? moyennesQuestions.reduce((a, b) => a + b, 0) / moyennesQuestions.length : null;

  return { totalSoumissions, questionsFermees, questionsOuvertes, modules, moyenneGlobale };
}
