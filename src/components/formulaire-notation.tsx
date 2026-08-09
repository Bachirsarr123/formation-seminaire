'use client';

import { useActionState, useId } from 'react';
import { LIBELLE_TYPE_NOTATION } from '@/lib/libelles';
import type { NotationExistante } from '@/lib/organisateur/notations';

// Partagé entre l'espace organisateur (notations/actions.ts) et /f/{codeFormateur}
// (app/f/[codeFormateur]/notations/actions.ts) — même formulaire, deux
// actions différentes qui vérifient chacune l'accès à leur façon (session vs
// code formateur).
export interface EtatNotation {
  erreur?: string;
}

const ETAT_INITIAL: EtatNotation = {};
const TYPES = Object.keys(LIBELLE_TYPE_NOTATION) as (keyof typeof LIBELLE_TYPE_NOTATION)[];

interface Props {
  action: (etat: EtatNotation, formData: FormData) => Promise<EtatNotation>;
  notationExistante: NotationExistante | null;
}

// Champs valeur/barème TOUJOURS affichés, jamais masqués selon le type
// choisi (même discipline que FormulaireQuestion pour le questionnaire
// d'évaluation) : un masquage dynamique dépendrait de JS pour être fiable,
// la validation serveur (enregistrerNotation) revérifie de toute façon la
// cohérence attendue pour APPRECIATION.
export function FormulaireNotation({ action, notationExistante }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  return (
    <form action={envoyer} className="flex flex-col gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-type`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Type
          </label>
          <select id={`${idBase}-type`} name="typeNotation" required defaultValue={notationExistante?.typeNotation ?? 'PRESENCE'}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {LIBELLE_TYPE_NOTATION[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-valeur`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Valeur (vide pour une appréciation)
          </label>
          <input id={`${idBase}-valeur`} type="number" name="valeur" step="0.01" defaultValue={notationExistante?.valeur ?? ''} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-bareme`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Barème (ex. 20)
          </label>
          <input id={`${idBase}-bareme`} type="number" name="bareme" step="0.01" defaultValue={notationExistante?.bareme ?? ''} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-justification`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Justification
        </label>
        <textarea
          id={`${idBase}-justification`}
          name="justification"
          rows={2}
          required
          defaultValue={notationExistante?.justification ?? ''}
        />
      </div>

      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        {notationExistante ? 'Mettre à jour' : 'Enregistrer'}
      </button>
    </form>
  );
}
