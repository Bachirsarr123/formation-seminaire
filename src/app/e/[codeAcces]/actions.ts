'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NOM_CHAMP_HONEYPOT, avecIdempotence, estHoneypotRempli, verifierDelaiFormulaire, verifierLimiteIP } from '@/lib/anti-spam';
import { chargerEvaluationPublique, soumettreReponseEvaluationPublique } from '@/lib/questionnaire/public';
import { analyserReponsesFormulaire, nomChampQuestion, type QuestionPourValidation } from '@/lib/questionnaire/validation-reponses';
import { soumissionSchema } from '@/lib/validation/soumission.schema';

export interface EtatSoumissionEvaluationPublique {
  erreurGenerale?: string;
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
 * Même formulaire, mêmes règles de validation que mon-espace/questionnaire
 * (lien personnel /p/{jeton}) — seule différence : pas de jeton à résoudre,
 * pas d'inscription à marquer « a répondu ». Protégée par les mêmes
 * anti-abus que le recueil de besoins (honeypot, délai minimum signé,
 * limite par IP, idempotence) puisque ce lien, comme celui du recueil, est
 * public et largement diffusé — voir src/app/r/[codeAcces]/actions.ts.
 */
export async function soumettreEvaluationPubliqueAction(
  codeAcces: string,
  _etatPrecedent: EtatSoumissionEvaluationPublique,
  formData: FormData,
): Promise<EtatSoumissionEvaluationPublique> {
  const valeursVides = { erreurs: {}, valeurs: {}, premiereErreurId: null };

  if (estHoneypotRempli(String(formData.get(NOM_CHAMP_HONEYPOT) ?? ''))) {
    return valeursVides;
  }

  const timestamp = String(formData.get('jetonFormulaireTimestamp') ?? '');
  const signature = String(formData.get('jetonFormulaireSignature') ?? '');
  if (!verifierDelaiFormulaire(timestamp, signature)) {
    return { ...valeursVides, erreurGenerale: 'Votre formulaire a expiré. Veuillez le soumettre à nouveau.' };
  }

  const enTetes = await headers();
  const ip = enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
  if (!verifierLimiteIP(ip)) {
    return { ...valeursVides, erreurGenerale: 'Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.' };
  }

  const evaluation = await chargerEvaluationPublique(codeAcces);
  if (!evaluation || !evaluation.questionnaire) {
    return { ...valeursVides, erreurGenerale: "Ce questionnaire n'est plus disponible." };
  }
  const { questionnaire } = evaluation;

  const questionnaireId = String(formData.get('questionnaireId') ?? '');
  if (questionnaireId !== questionnaire.id) {
    return { ...valeursVides, erreurGenerale: "Ce questionnaire n'est plus disponible." };
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
  const cleIdempotence = timestamp && signature ? signature : `${codeAcces}-${ip}-${Date.now()}`;

  await avecIdempotence(cleIdempotence, () =>
    soumettreReponseEvaluationPublique(questionnaireId, soumissionValidee.reponses),
  );

  redirect(`/e/${codeAcces}/merci`);
}
