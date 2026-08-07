'use client';

import { useActionState, useId } from 'react';
import { LIBELLE_TYPE_RECUEIL_QUESTION } from '@/lib/libelles';
import type { EtatFormulaireQuestionRecueil } from './actions';

const ETAT_INITIAL: EtatFormulaireQuestionRecueil = {};
const TYPES = Object.keys(LIBELLE_TYPE_RECUEIL_QUESTION) as (keyof typeof LIBELLE_TYPE_RECUEIL_QUESTION)[];
const NB_CHOIX = 8;

interface Props {
  action: (etat: EtatFormulaireQuestionRecueil, formData: FormData) => Promise<EtatFormulaireQuestionRecueil>;
}

// Toujours visible, jamais masquée derrière un bouton "+" — même discipline
// que FormulaireAjouterSection (questionnaire d'évaluation) : cet écran doit
// rester utilisable sans JavaScript. Les champs "choix" et "avecAutre" sont
// TOUJOURS affichés, jamais montrés/masqués dynamiquement selon le type
// choisi (dépendrait de JS) — ajouterQuestionRecueilAction ne lit que le
// bloc pertinent pour le type réellement soumis.
export function FormulaireQuestionRecueil({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Ajouter une question</h2>

      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-intitule`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Intitulé
        </label>
        <input id={`${idBase}-intitule`} type="text" name="intitule" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-type`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Type
        </label>
        <select id={`${idBase}-type`} name="type" required defaultValue="TEXTE_LIBRE">
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {LIBELLE_TYPE_RECUEIL_QUESTION[type]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-[var(--rayon-sm)] border border-[color:var(--gris-100)] p-3">
        <legend className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Choix (uniquement si le type est « Choix unique » ou « Choix multiple »)
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: NB_CHOIX }, (_, i) => i + 1).map((n) => (
            <input key={n} type="text" name={`choixLibelle${n}`} placeholder={`Choix ${n}`} />
          ))}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="avecAutre" />
          Ajouter une case « Autre » avec saisie libre (choix multiple uniquement)
        </label>
      </fieldset>

      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        Ajouter la question
      </button>
    </form>
  );
}
