import type { Prisma, TypeRecueilQuestion } from '@prisma/client';
import { avecAutreRecueil, choixRecueil } from '@/lib/recueil/options';
import { VALEUR_AUTRE, nomChampRecueilAutre, nomChampRecueilQuestion } from '@/lib/recueil/validation-reponses';

// Composant volontairement séparé de components/questionnaire/question.tsx
// (lot d'évaluation) : même s'il s'en inspire visuellement, le recueil ne
// doit jamais dépendre du code du questionnaire d'évaluation, même par un
// import partagé qui les couplerait discrètement.
export interface RecueilQuestionAAfficher {
  id: string;
  intitule: string;
  type: TypeRecueilQuestion;
  options: Prisma.JsonValue | null;
}

// Aucune question n'est obligatoire dans ce lot : jamais de `required`, jamais
// de message d'erreur "réponse requise".
export function QuestionRecueil({ question, numero }: { question: RecueilQuestionAAfficher; numero: number }) {
  const champ = nomChampRecueilQuestion(question.id);

  if (question.type === 'TEXTE_LIBRE') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={champ} className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          {numero}. {question.intitule}
        </label>
        <textarea id={champ} name={champ} rows={3} maxLength={5000} />
      </div>
    );
  }

  const choix = choixRecueil(question.options);
  const autre = question.type === 'CHOIX_MULTIPLE' && avecAutreRecueil(question.options);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
        {numero}. {question.intitule}
      </legend>
      <div className="flex flex-col gap-2">
        {choix.map((option) => (
          <label key={option.id} className="flex min-h-[44px] items-center gap-3">
            <input type={question.type === 'CHOIX_UNIQUE' ? 'radio' : 'checkbox'} name={champ} value={option.id} />
            {option.libelle}
          </label>
        ))}
        {autre ? (
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" name={champ} value={VALEUR_AUTRE} />
            Autre :
            <input
              type="text"
              name={nomChampRecueilAutre(question.id)}
              className="min-w-0 flex-1"
              aria-label="Précisez « Autre »"
            />
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}
