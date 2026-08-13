import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { QuestionAAfficher } from '@/components/questionnaire/question';

export interface SectionEvaluationPublique {
  id: string;
  titre: string;
  description: string | null;
  questions: QuestionAAfficher[];
}

export interface EvaluationPublique {
  seminaire: { titre: string; codePublic: string; logoClientUrl: string | null };
  cabinet: {
    id: string;
    nom: string;
    logoUrl: string | null;
    couleurPrimaire: string;
    adresse: string | null;
    emailContact: string | null;
    telephoneContact: string | null;
  };
  // `null` avec `messageIndisponible` renseigné : pas encore de questionnaire
  // publié, ou délai de réponse dépassé — même distinction que
  // mon-espace/questionnaire/page.tsx, pour un message cohérent aux deux
  // points d'accès.
  questionnaire: { id: string; sections: SectionEvaluationPublique[] } | null;
  messageIndisponible: string | null;
}

/**
 * Aucune authentification (même registre que le recueil de besoins,
 * lib/recueil/public.ts) : le code d'accès EST le contrôle d'accès. Résout
 * le questionnaire PUBLIÉ le plus récent du séminaire — même requête que
 * mon-espace/questionnaire/page.tsx — plutôt que de figer un questionnaireId
 * dans le code, pour rester valide si l'organisateur republie une nouvelle
 * version après verrouillage.
 */
export async function chargerEvaluationPublique(codeAcces: string): Promise<EvaluationPublique | null> {
  const seminaire = await prisma.seminaire.findUnique({
    where: { codeAccesEvaluation: codeAcces },
    select: {
      id: true,
      titre: true,
      codePublic: true,
      logoClientUrl: true,
      supprimeLe: true,
      cabinet: {
        select: { id: true, nom: true, logoUrl: true, couleurPrimaire: true, adresse: true, emailContact: true, telephoneContact: true },
      },
    },
  });
  if (!seminaire || seminaire.supprimeLe) return null;

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { seminaireId: seminaire.id, statut: 'PUBLIE', supprimeLe: null },
    orderBy: { createdAt: 'desc' },
    include: {
      sections: {
        orderBy: { ordre: 'asc' },
        include: { questions: { where: { supprimeLe: null }, orderBy: { ordre: 'asc' } } },
      },
    },
  });

  let messageIndisponible: string | null = null;
  if (!questionnaire) {
    messageIndisponible = "Le questionnaire d'évaluation n'est pas encore disponible.";
  } else if (questionnaire.dateLimite && questionnaire.dateLimite < new Date()) {
    messageIndisponible = 'Le délai pour répondre à ce questionnaire est passé.';
  }

  return {
    seminaire: { titre: seminaire.titre, codePublic: seminaire.codePublic, logoClientUrl: seminaire.logoClientUrl },
    cabinet: seminaire.cabinet,
    questionnaire: questionnaire && !messageIndisponible ? { id: questionnaire.id, sections: questionnaire.sections } : null,
    messageIndisponible,
  };
}

export interface ReponseEvaluationPubliqueInput {
  questionId: string;
  valeurNumerique?: number;
  valeurTexte?: string;
  valeurOptions?: Prisma.InputJsonValue;
}

/**
 * Soumission publique (lien /e/{code}, sans identité) : une simple
 * insertion, sans mise à jour d'inscription — il n'y a pas de participant
 * identifié dont marquer « a répondu ». Cohérent avec la Règle 2 : la table
 * Soumission n'a de toute façon jamais porté de lien vers une identité, que
 * l'accès passe par ce lien public ou par le lien personnel /p/{jeton}
 * (lib/soumission.ts).
 */
export async function soumettreReponseEvaluationPublique(
  questionnaireId: string,
  reponses: ReponseEvaluationPubliqueInput[],
): Promise<void> {
  await prisma.soumission.create({
    data: {
      questionnaireId,
      reponses: {
        create: reponses.map((r) => ({
          questionId: r.questionId,
          valeurNumerique: r.valeurNumerique,
          valeurTexte: r.valeurTexte,
          valeurOptions: r.valeurOptions,
        })),
      },
    },
  });
}
