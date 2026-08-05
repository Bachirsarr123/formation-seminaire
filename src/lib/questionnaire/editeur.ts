import 'server-only';
import { Prisma, type Question, type Section, type StatutQuestionnaire, type TypeQuestion } from '@prisma/client';
import { prisma } from '../prisma';
import { verrouillageEffectif } from './verrouillage';
import { QuestionnaireIntrouvableError } from './dupliquer';

export { QuestionnaireIntrouvableError };

export type Direction = 'HAUT' | 'BAS';

/**
 * Message explicite AVANT que Postgres ne le fasse échouer (triggers
 * section_verrouillage/question_verrouillage, migration 20260802123859) :
 * l'interface doit dire pourquoi, pas seulement échouer. Une fois qu'au
 * moins une réponse existe, changer le libellé d'une question agrégerait
 * silencieusement des réponses à deux questions différentes dans la même
 * moyenne — la seule voie est un nouveau questionnaire (dupliquerQuestionnaire).
 */
export class StructureVerrouilleeError extends Error {
  constructor() {
    super(
      "La structure est figée : au moins une réponse a déjà été reçue. La modifier maintenant " +
        'agrégerait des réponses à des questions différentes dans les mêmes moyennes. ' +
        'Dupliquez ce questionnaire pour repartir sur une version modifiable.',
    );
    this.name = 'StructureVerrouilleeError';
  }
}

// ============================================================
// Lecture — structure complète pour l'éditeur (lot 5, partie A). Même écran
// pour un modèle et pour le questionnaire d'un séminaire : cette fonction ne
// distingue pas les deux, l'appelant lit `seminaireId`/`estModele` s'il a
// besoin d'adapter l'affichage (ex. la liste des modules n'a de sens que
// pour un séminaire).
// ============================================================

export interface QuestionPourEdition {
  id: string;
  intitule: string;
  description: string | null;
  type: TypeQuestion;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  moduleId: string | null;
  options: Prisma.JsonValue | null;
  ordre: number;
}

export interface SectionPourEdition {
  id: string;
  titre: string;
  description: string | null;
  ordre: number;
  questions: QuestionPourEdition[];
}

export interface QuestionnairePourEdition {
  id: string;
  cabinetId: string;
  estModele: boolean;
  seminaireId: string | null;
  nom: string | null;
  titre: string;
  statut: StatutQuestionnaire;
  dateLimite: Date | null;
  modeleOrigineId: string | null;
  sections: SectionPourEdition[];
}

export async function obtenirQuestionnairePourEditeur(
  cabinetId: string,
  questionnaireId: string,
): Promise<QuestionnairePourEdition | null> {
  return prisma.questionnaire.findFirst({
    where: { id: questionnaireId, cabinetId, supprimeLe: null },
    select: {
      id: true,
      cabinetId: true,
      estModele: true,
      seminaireId: true,
      nom: true,
      titre: true,
      statut: true,
      dateLimite: true,
      modeleOrigineId: true,
      sections: {
        orderBy: { ordre: 'asc' },
        select: {
          id: true,
          titre: true,
          description: true,
          ordre: true,
          questions: {
            where: { supprimeLe: null },
            orderBy: { ordre: 'asc' },
            select: {
              id: true,
              intitule: true,
              description: true,
              type: true,
              obligatoire: true,
              autoriseSansOpinion: true,
              moduleId: true,
              options: true,
              ordre: true,
            },
          },
        },
      },
    },
  });
}

// ============================================================
// Écriture — chaque fonction vérifie l'appartenance au cabinet (règle B) ET
// `structureModifiable` avant d'écrire, pour renvoyer StructureVerrouilleeError
// plutôt que de laisser remonter l'exception Postgres brute des triggers.
// ============================================================

async function obtenirQuestionnaireModifiable(cabinetId: string, questionnaireId: string): Promise<{ id: string }> {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!questionnaire) throw new QuestionnaireIntrouvableError();

  const { structureModifiable } = await verrouillageEffectif(questionnaireId);
  if (!structureModifiable) throw new StructureVerrouilleeError();

  return questionnaire;
}

async function obtenirSectionModifiable(
  cabinetId: string,
  sectionId: string,
): Promise<{ id: string; questionnaireId: string; ordre: number }> {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, questionnaire: { cabinetId, supprimeLe: null } },
    select: { id: true, questionnaireId: true, ordre: true },
  });
  if (!section) throw new QuestionnaireIntrouvableError();

  const { structureModifiable } = await verrouillageEffectif(section.questionnaireId);
  if (!structureModifiable) throw new StructureVerrouilleeError();

  return section;
}

async function obtenirQuestionModifiable(
  cabinetId: string,
  questionId: string,
): Promise<{ id: string; sectionId: string; ordre: number; questionnaireId: string }> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, supprimeLe: null, section: { questionnaire: { cabinetId, supprimeLe: null } } },
    select: { id: true, sectionId: true, ordre: true, section: { select: { questionnaireId: true } } },
  });
  if (!question) throw new QuestionnaireIntrouvableError();

  const { structureModifiable } = await verrouillageEffectif(question.section.questionnaireId);
  if (!structureModifiable) throw new StructureVerrouilleeError();

  return { id: question.id, sectionId: question.sectionId, ordre: question.ordre, questionnaireId: question.section.questionnaireId };
}

export interface DonneesSection {
  titre: string;
  description?: string | null;
}

export async function ajouterSection(cabinetId: string, questionnaireId: string, donnees: DonneesSection): Promise<Section> {
  await obtenirQuestionnaireModifiable(cabinetId, questionnaireId);
  const dernier = await prisma.section.aggregate({ where: { questionnaireId }, _max: { ordre: true } });
  return prisma.section.create({
    data: {
      questionnaireId,
      titre: donnees.titre,
      description: donnees.description ?? null,
      ordre: (dernier._max.ordre ?? 0) + 1,
    },
  });
}

export async function renommerSection(cabinetId: string, sectionId: string, donnees: DonneesSection): Promise<Section> {
  await obtenirSectionModifiable(cabinetId, sectionId);
  return prisma.section.update({
    where: { id: sectionId },
    data: { titre: donnees.titre, description: donnees.description ?? null },
  });
}

/**
 * Échange l'`ordre` avec le voisin immédiat (pas de glisser-déposer,
 * inutilisable au doigt et impossible sans JS). Ni erreur ni effet si déjà
 * en haut/en bas de sa section — un bouton "monter" sur la première ligne
 * ne fait simplement rien.
 */
export async function deplacerSection(cabinetId: string, sectionId: string, direction: Direction): Promise<void> {
  const section = await obtenirSectionModifiable(cabinetId, sectionId);
  const voisine = await prisma.section.findFirst({
    where: {
      questionnaireId: section.questionnaireId,
      ordre: direction === 'HAUT' ? { lt: section.ordre } : { gt: section.ordre },
    },
    orderBy: { ordre: direction === 'HAUT' ? 'desc' : 'asc' },
  });
  if (!voisine) return;

  await prisma.$transaction([
    prisma.section.update({ where: { id: section.id }, data: { ordre: voisine.ordre } }),
    prisma.section.update({ where: { id: voisine.id }, data: { ordre: section.ordre } }),
  ]);
}

/**
 * Suppression PHYSIQUE (Section n'a pas de `supprimeLe` dans le schéma,
 * contrairement à Question) — sûre uniquement parce qu'elle n'est jamais
 * permise après verrouillage (garde ci-dessus) : tant qu'aucune réponse
 * n'existe pour ce questionnaire, aucune de ses questions ne peut avoir de
 * Reponse (Reponse.question est en onDelete Restrict). Cascade sur les
 * questions de la section (schema.prisma).
 */
export async function supprimerSection(cabinetId: string, sectionId: string): Promise<void> {
  await obtenirSectionModifiable(cabinetId, sectionId);
  await prisma.section.delete({ where: { id: sectionId } });
}

export interface DonneesQuestion {
  intitule: string;
  description?: string | null;
  type: TypeQuestion;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  moduleId?: string | null;
  options: Prisma.InputJsonValue | null;
}

// `null` doit effacer explicitement une valeur JSON existante (changement de
// type qui abandonne ses options) — un simple `undefined` dans un UPDATE
// Prisma signifierait "ne pas toucher au champ", pas "l'effacer".
function valeurOptionsPourEcriture(
  options: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return options === null ? Prisma.DbNull : options;
}

export async function ajouterQuestion(cabinetId: string, sectionId: string, donnees: DonneesQuestion): Promise<Question> {
  const section = await obtenirSectionModifiable(cabinetId, sectionId);
  const dernier = await prisma.question.aggregate({
    where: { sectionId: section.id, supprimeLe: null },
    _max: { ordre: true },
  });
  return prisma.question.create({
    data: {
      sectionId: section.id,
      intitule: donnees.intitule,
      description: donnees.description ?? null,
      type: donnees.type,
      obligatoire: donnees.obligatoire,
      autoriseSansOpinion: donnees.autoriseSansOpinion,
      moduleId: donnees.moduleId ?? null,
      options: valeurOptionsPourEcriture(donnees.options),
      ordre: (dernier._max.ordre ?? 0) + 1,
    },
  });
}

export async function modifierQuestion(cabinetId: string, questionId: string, donnees: DonneesQuestion): Promise<Question> {
  await obtenirQuestionModifiable(cabinetId, questionId);
  return prisma.question.update({
    where: { id: questionId },
    data: {
      intitule: donnees.intitule,
      description: donnees.description ?? null,
      type: donnees.type,
      obligatoire: donnees.obligatoire,
      autoriseSansOpinion: donnees.autoriseSansOpinion,
      moduleId: donnees.moduleId ?? null,
      options: valeurOptionsPourEcriture(donnees.options),
    },
  });
}

export async function deplacerQuestion(cabinetId: string, questionId: string, direction: Direction): Promise<void> {
  const question = await obtenirQuestionModifiable(cabinetId, questionId);
  const voisine = await prisma.question.findFirst({
    where: {
      sectionId: question.sectionId,
      supprimeLe: null,
      ordre: direction === 'HAUT' ? { lt: question.ordre } : { gt: question.ordre },
    },
    orderBy: { ordre: direction === 'HAUT' ? 'desc' : 'asc' },
  });
  if (!voisine) return;

  await prisma.$transaction([
    prisma.question.update({ where: { id: question.id }, data: { ordre: voisine.ordre } }),
    prisma.question.update({ where: { id: voisine.id }, data: { ordre: question.ordre } }),
  ]);
}

/** Suppression LOGIQUE (`supprimeLe`) — jamais physique, voir schema.prisma. */
export async function supprimerQuestion(cabinetId: string, questionId: string): Promise<void> {
  await obtenirQuestionModifiable(cabinetId, questionId);
  await prisma.question.update({ where: { id: questionId }, data: { supprimeLe: new Date() } });
}
