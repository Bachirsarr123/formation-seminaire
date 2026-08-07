'use client';

import { useActionState } from 'react';
import type { EtatFormulaireCreerRecueil } from './actions';

const ETAT_INITIAL: EtatFormulaireCreerRecueil = {};

interface Props {
  action: (etat: EtatFormulaireCreerRecueil, formData: FormData) => Promise<EtatFormulaireCreerRecueil>;
}

export function FormulaireCreerRecueil({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-4 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="titre" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Titre du formulaire
        </label>
        <input id="titre" type="text" name="titre" placeholder="Formulaire de recueil des besoins" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Texte d&apos;objectif (affiché en tête du formulaire)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Ce questionnaire vise à permettre au formateur de mieux comprendre vos besoins, vos attentes..."
          required
        />
      </div>

      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        Créer le recueil
      </button>
    </form>
  );
}
