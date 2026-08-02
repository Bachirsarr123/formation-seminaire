'use server';

import { redirect } from 'next/navigation';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { prisma } from '@/lib/prisma';
import { SoumissionDejaEffectueeError, soumettreReponses } from '@/lib/soumission';
import { analyserReponsesFormulaire, nomChampQuestion, type QuestionPourValidation } from '@/lib/questionnaire/validation-reponses';
import { soumissionSchema } from '@/lib/validation/soumission.schema';

export interface EtatSoumissionQuestionnaire {
  erreurs: Record<string, string>;
  valeurs: Record<string, string | string[]>;
  premiereErreurId: string | null;
}

function extraireValeursPourReaffichage(
  questions: QuestionPourValidation[],
  formData: FormData,
): Record<string, string | string[]> {
  const valeurs: Record<string, string | string[]> = {};
  for (const question of questions) {
    const champ = nomChampQuestion(question.id);
    if (question.type === 'QCM_MULTIPLE') {
      const bruts = formData.getAll(champ).map(String).filter((v) => v !== '');
      if (bruts.length > 0) valeurs[question.id] = bruts;
    } else {
      const brut = formData.get(champ);
      if (typeof brut === 'string' && brut !== '') valeurs[question.id] = brut;
    }
  }
  return valeurs;
}

/**
 * Une seule page, une seule soumission finale (Règle 2 : aucun brouillon
 * rattaché au jeton ne doit jamais être écrit). En cas de validation
 * échouée, on ne redirige jamais : on ré-affiche le même formulaire avec les
 * valeurs déjà saisies (état renvoyé par l'action, jamais stocké en base) —
 * voir FormulaireQuestionnaire, qui reçoit cet état via useActionState.
 */
export async function soumettreQuestionnaireAction(
  _etatPrecedent: EtatSoumissionQuestionnaire,
  formData: FormData,
): Promise<EtatSoumissionQuestionnaire> {
  const jeton = await lireJetonSession();
  if (!jeton) redirect('/mon-espace/questionnaire');

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) redirect('/mon-espace/questionnaire');

  if (contexte.inscription.aRepondu) redirect('/mon-espace/questionnaire/merci');

  const questionnaireId = String(formData.get('questionnaireId') ?? '');
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, seminaireId: contexte.seminaire.id, statut: 'PUBLIE', supprimeLe: null },
    include: {
      sections: {
        orderBy: { ordre: 'asc' },
        include: { questions: { where: { supprimeLe: null }, orderBy: { ordre: 'asc' } } },
      },
    },
  });

  // Questionnaire introuvable, dépublié ou date limite dépassée depuis
  // l'ouverture du formulaire : la page GET tranche seule ce qu'il faut
  // afficher, en relisant la vérité en base — pas de message dupliqué ici.
  if (!questionnaire || (questionnaire.dateLimite && questionnaire.dateLimite < new Date())) {
    redirect('/mon-espace/questionnaire');
  }

  const questions: QuestionPourValidation[] = questionnaire.sections.flatMap((section) => section.questions);
  const { reponses, erreurs } = analyserReponsesFormulaire(questions, formData);

  if (erreurs.length > 0) {
    return {
      erreurs: Object.fromEntries(erreurs.map((e) => [e.questionId, e.message])),
      valeurs: extraireValeursPourReaffichage(questions, formData),
      premiereErreurId: erreurs[0]!.questionId,
    };
  }

  const soumissionValidee = soumissionSchema.parse({ questionnaireId, reponses });

  try {
    await soumettreReponses({ jeton, questionnaireId, reponses: soumissionValidee.reponses });
  } catch (erreur) {
    if (erreur instanceof SoumissionDejaEffectueeError) {
      redirect('/mon-espace/questionnaire/merci');
    }
    throw erreur;
  }

  redirect('/mon-espace/questionnaire/merci');
}
