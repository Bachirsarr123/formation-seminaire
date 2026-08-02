import type { Prisma, TypeQuestion } from '@prisma/client';
import { choixQcm, estTypeEchelle, libellesEchelle4 } from '@/lib/questionnaire/echelles';
import { nomChampQuestion } from '@/lib/questionnaire/validation-reponses';
import { EchelleNotation } from './echelle-notation';

export interface QuestionAAfficher {
  id: string;
  intitule: string;
  description: string | null;
  type: TypeQuestion;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  options: Prisma.JsonValue | null;
}

interface QuestionProps {
  question: QuestionAAfficher;
  valeurInitiale?: string | string[];
  enErreur?: boolean;
}

export function Question({ question, valeurInitiale, enErreur }: QuestionProps) {
  const champ = nomChampQuestion(question.id);

  if (estTypeEchelle(question.type)) {
    return (
      <EchelleNotation
        questionId={question.id}
        type={question.type}
        intitule={question.intitule}
        description={question.description}
        obligatoire={question.obligatoire}
        autoriseSansOpinion={question.autoriseSansOpinion}
        libelles={libellesEchelle4(question.options)}
        valeurInitiale={typeof valeurInitiale === 'string' ? valeurInitiale : undefined}
        enErreur={enErreur}
      />
    );
  }

  if (question.type === 'OUI_NON') {
    return (
      <fieldset id={`question-${question.id}`} tabIndex={-1} className={enErreur ? 'echelle-erreur' : undefined}>
        <Legende question={question} />
        {enErreur ? <ErreurRequise /> : null}
        <div className="echelle-grille" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxWidth: 240 }}>
          {(['1', '0'] as const).map((valeur) => (
            <div className="echelle-tuile" key={valeur}>
              <input
                type="radio"
                className="echelle-option"
                id={`${champ}-${valeur}`}
                name={champ}
                value={valeur}
                required={question.obligatoire}
                defaultChecked={valeurInitiale === valeur}
              />
              <label htmlFor={`${champ}-${valeur}`}>{valeur === '1' ? 'Oui' : 'Non'}</label>
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'QCM_UNIQUE' || question.type === 'QCM_MULTIPLE') {
    const choix = choixQcm(question.options);
    const valeursChoisies = new Set(Array.isArray(valeurInitiale) ? valeurInitiale : valeurInitiale ? [valeurInitiale] : []);
    return (
      <fieldset id={`question-${question.id}`} tabIndex={-1}>
        <Legende question={question} />
        {enErreur ? <ErreurRequise /> : null}
        <div className="flex flex-col gap-2">
          {choix.map((option) => (
            <label key={option.id} className="flex min-h-[44px] items-center gap-3">
              <input
                type={question.type === 'QCM_UNIQUE' ? 'radio' : 'checkbox'}
                name={champ}
                value={option.id}
                required={question.obligatoire && question.type === 'QCM_UNIQUE'}
                defaultChecked={valeursChoisies.has(option.id)}
              />
              {option.libelle}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  // TEXTE_LIBRE
  return (
    <fieldset id={`question-${question.id}`} tabIndex={-1}>
      <Legende question={question} />
      {enErreur ? <ErreurRequise /> : null}
      <textarea
        name={champ}
        required={question.obligatoire}
        maxLength={5000}
        rows={4}
        defaultValue={typeof valeurInitiale === 'string' ? valeurInitiale : ''}
      />
    </fieldset>
  );
}

function Legende({ question }: { question: QuestionAAfficher }) {
  return (
    <>
      <legend className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
        {question.intitule}
        {question.obligatoire ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {question.description ? <p className="text-[color:var(--gris-600)]">{question.description}</p> : null}
    </>
  );
}

function ErreurRequise() {
  return (
    <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
      Réponse requise.
    </p>
  );
}
