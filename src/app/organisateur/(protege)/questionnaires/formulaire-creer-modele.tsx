'use client';

import { useActionState, useState } from 'react';
import { creerModeleAction, type EtatFormulaireModele } from './actions';

const ETAT_INITIAL: EtatFormulaireModele = {};

export function FormulaireCreerModele() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer] = useActionState(creerModeleAction, ETAT_INITIAL);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
      >
        + Créer un modèle
      </button>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="nom" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Nom du modèle (bibliothèque)
          </label>
          <input id="nom" type="text" name="nom" required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="titre" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Titre (vu par les participants)
          </label>
          <input id="titre" type="text" name="titre" required />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
        >
          Créer et ouvrir l&apos;éditeur
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-transparent px-4 text-[color:var(--gris-700)] underline"
        >
          Annuler
        </button>
      </div>

      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
