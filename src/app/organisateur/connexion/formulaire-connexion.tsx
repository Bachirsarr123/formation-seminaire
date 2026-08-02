'use client';

import { useActionState } from 'react';
import { connecterAction, type EtatConnexion } from './actions';

const ETAT_INITIAL: EtatConnexion = {};

export function FormulaireConnexion() {
  const [etat, envoyer] = useActionState(connecterAction, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          E-mail
        </label>
        <input id="email" type="email" name="email" required autoComplete="username" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="motDePasse" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          Mot de passe
        </label>
        <input id="motDePasse" type="password" name="motDePasse" required autoComplete="current-password" />
      </div>
      <button
        type="submit"
        className="mt-2 min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Se connecter
      </button>
    </form>
  );
}
