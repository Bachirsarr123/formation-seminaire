'use client';

import { useActionState } from 'react';
import { demanderReinitialisationAction, type EtatMotDePasseOublie } from './actions';

const ETAT_INITIAL: EtatMotDePasseOublie = {};

export function FormulaireMotDePasseOublie() {
  const [etat, envoyer] = useActionState(demanderReinitialisationAction, ETAT_INITIAL);

  if (etat.envoye) {
    return (
      <p className="text-[color:var(--gris-700)]">
        Si un compte existe avec cette adresse, un lien de réinitialisation vient de lui être envoyé (valable une
        heure).
      </p>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          E-mail
        </label>
        <input id="email" type="email" name="email" required autoComplete="username" />
      </div>
      <button
        type="submit"
        className="mt-2 min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Envoyer le lien
      </button>
    </form>
  );
}
