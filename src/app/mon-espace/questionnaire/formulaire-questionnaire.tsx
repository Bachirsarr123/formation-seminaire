'use client';

import { useActionState, useEffect, useRef } from 'react';
import { restaurer, sauvegarder } from '@/lib/client/sauvegarde-locale';
import { Question, type QuestionAAfficher } from '@/components/questionnaire/question';
import { CompteurProgression } from '@/components/questionnaire/compteur-progression';
import { soumettreQuestionnaireAction, type EtatSoumissionQuestionnaire } from './actions';

interface SectionAffichee {
  id: string;
  titre: string;
  description: string | null;
  questions: QuestionAAfficher[];
}

interface FormulaireQuestionnaireProps {
  titreSeminaire: string;
  questionnaireId: string;
  sections: SectionAffichee[];
  champs: string[];
}

const ID_FORMULAIRE = 'formulaire-questionnaire';

// Défini ici, jamais importé d'actions.ts ('use server') : ce module n'a le
// droit d'exporter que des fonctions async — une constante y survivrait mal
// au franchissement de la frontière serveur/client (valeur perdue, etat.*
// undefined au premier rendu, y compris sans JS).
const ETAT_INITIAL: EtatSoumissionQuestionnaire = { erreurs: {}, valeurs: {}, premiereErreurId: null };

/**
 * Toujours utilisable sans JavaScript : `action={envoyer}` est une Server
 * Action liée nativement au <form>, qui accepte un POST classique du
 * navigateur. Tout ce qui suit dans ce composant (sauvegarde locale,
 * compteur, défilement vers l'erreur) est un rehaussement — rien de tout ça
 * n'est nécessaire pour remplir et envoyer le questionnaire.
 */
export function FormulaireQuestionnaire({
  titreSeminaire,
  questionnaireId,
  sections,
  champs,
}: FormulaireQuestionnaireProps) {
  const [etat, envoyer] = useActionState(soumettreQuestionnaireAction, ETAT_INITIAL);
  const formRef = useRef<HTMLFormElement | null>(null);
  const cle = `questionnaire-${questionnaireId}`;

  // Restauration au montage uniquement : une coupure réseau ou un
  // rechargement en cours de saisie. Un aller-retour de validation serveur
  // ne remonte pas ce composant (mêmes nœuds React), donc ne redéclenche
  // jamais cet effet — pas de conflit avec les valeurs déjà ré-affichées par
  // le serveur.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const entrees = restaurer<[string, string][]>(cle);
    if (!entrees) return;
    for (const [nom, valeur] of entrees) {
      const element = form.elements.namedItem(nom);
      if (!element) continue;
      if (element instanceof RadioNodeList) {
        for (const item of Array.from(element)) {
          if (item instanceof HTMLInputElement && item.value === valeur) item.checked = true;
        }
      } else if (element instanceof HTMLInputElement) {
        if (element.type === 'radio' || element.type === 'checkbox') {
          if (element.value === valeur) element.checked = true;
        } else {
          element.value = valeur;
        }
      } else if (element instanceof HTMLTextAreaElement) {
        element.value = valeur;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function sauvegarderEtat() {
      const donnees = new FormData(form as HTMLFormElement);
      const entrees = Array.from(donnees.entries()).filter((e): e is [string, string] => typeof e[1] === 'string');
      sauvegarder(cle, entrees);
    }
    form.addEventListener('input', sauvegarderEtat);
    form.addEventListener('change', sauvegarderEtat);
    return () => {
      form.removeEventListener('input', sauvegarderEtat);
      form.removeEventListener('change', sauvegarderEtat);
    };
  }, [cle]);

  useEffect(() => {
    if (!etat.premiereErreurId) return;
    const cible = document.getElementById(`question-${etat.premiereErreurId}`);
    cible?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (cible instanceof HTMLElement) cible.focus();
  }, [etat.premiereErreurId]);

  const nbErreurs = Object.keys(etat.erreurs).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-24">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{titreSeminaire}</h1>
      <p className="rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4 text-[color:var(--gris-700)]">
        Vos réponses sont anonymes. Nous savons que vous avez répondu, nous ne savons pas ce que vous avez répondu.
      </p>

      {nbErreurs > 0 ? (
        <p role="alert" className="text-[color:#b3261e]">
          {nbErreurs === 1 ? '1 question requiert une réponse.' : `${nbErreurs} questions requièrent une réponse.`}
        </p>
      ) : null}

      <form id={ID_FORMULAIRE} ref={formRef} action={envoyer} className="flex flex-col gap-8">
        <input type="hidden" name="questionnaireId" value={questionnaireId} />
        {sections.map((section) => (
          <section key={section.id} className="flex flex-col gap-6">
            <h2 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{section.titre}</h2>
            {section.description ? <p className="text-[color:var(--gris-600)]">{section.description}</p> : null}
            {section.questions.map((question) => (
              <Question
                key={question.id}
                question={question}
                valeurInitiale={etat.valeurs[question.id]}
                enErreur={question.id in etat.erreurs}
              />
            ))}
          </section>
        ))}

        <div className="barre-progression">
          <CompteurProgression formId={ID_FORMULAIRE} champs={champs} />
          <button
            type="submit"
            className="min-h-[56px] flex-1 rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
          >
            Envoyer mes réponses
          </button>
        </div>
      </form>
    </main>
  );
}
