'use client';

import { useActionState, useEffect, useRef } from 'react';
import { restaurer, sauvegarder } from '@/lib/client/sauvegarde-locale';
import { NOM_CHAMP_HONEYPOT } from '@/lib/anti-spam-honeypot';
import { Question, type QuestionAAfficher } from '@/components/questionnaire/question';
import { CompteurProgression } from '@/components/questionnaire/compteur-progression';
import { soumettreEvaluationPubliqueAction, type EtatSoumissionEvaluationPublique } from './actions';

interface SectionAffichee {
  id: string;
  titre: string;
  description: string | null;
  questions: QuestionAAfficher[];
}

interface Props {
  codeAcces: string;
  questionnaireId: string;
  sections: SectionAffichee[];
  champs: string[];
  jetonFormulaire: { timestamp: string; signature: string };
}

const ID_FORMULAIRE = 'formulaire-evaluation-publique';

const ETAT_INITIAL: EtatSoumissionEvaluationPublique = { erreurs: {}, valeurs: {}, premiereErreurId: null };

/**
 * Même formulaire, même design que mon-espace/questionnaire (lien
 * personnel) — voir formulaire-questionnaire.tsx — adapté au lien public :
 * action liée au code d'accès (pas au jeton de session), plus les mêmes
 * protections anti-abus que le formulaire public du recueil de besoins
 * (honeypot, délai minimum signé — voir formulaire-recueil.tsx).
 */
export function FormulaireEvaluationPublique({ codeAcces, questionnaireId, sections, champs, jetonFormulaire }: Props) {
  const action = soumettreEvaluationPubliqueAction.bind(null, codeAcces);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const formRef = useRef<HTMLFormElement | null>(null);
  const cle = `evaluation-publique-${questionnaireId}`;

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
    <form id={ID_FORMULAIRE} ref={formRef} action={envoyer} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="questionnaireId" value={questionnaireId} />
      <input type="hidden" name="jetonFormulaireTimestamp" value={jetonFormulaire.timestamp} />
      <input type="hidden" name="jetonFormulaireSignature" value={jetonFormulaire.signature} />

      {/* Honeypot : invisible et hors du parcours clavier pour un humain. */}
      <div className="leurre" aria-hidden="true">
        <label htmlFor={NOM_CHAMP_HONEYPOT}>Site web</label>
        <input type="text" id={NOM_CHAMP_HONEYPOT} name={NOM_CHAMP_HONEYPOT} tabIndex={-1} autoComplete="off" />
      </div>

      {etat.erreurGenerale ? (
        <p role="alert" className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-800)]">
          {etat.erreurGenerale}
        </p>
      ) : null}

      {nbErreurs > 0 ? (
        <p role="alert" className="text-[color:#b3261e]">
          {nbErreurs === 1 ? '1 question requiert une réponse.' : `${nbErreurs} questions requièrent une réponse.`}
        </p>
      ) : null}

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
  );
}
