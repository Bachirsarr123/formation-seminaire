'use client';

import { useActionState } from 'react';
import { reinitialiserAction, type EtatReinitialiser } from './actions';

const ETAT_INITIAL: EtatReinitialiser = {};

export function FormulaireReinitialiser({ jeton }: { jeton: string }) {
  const [etat, envoyer] = useActionState(reinitialiserAction, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="motDePasse" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          Nouveau mot de passe
        </label>
        <input id="motDePasse" type="password" name="motDePasse" required minLength={12} autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmation" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          Confirmer le mot de passe
        </label>
        <input id="confirmation" type="password" name="confirmation" required minLength={12} autoComplete="new-password" />
      </div>
      <button
        type="submit"
        className="mt-2 min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Changer le mot de passe
      </button>
    </form>
  );
}
