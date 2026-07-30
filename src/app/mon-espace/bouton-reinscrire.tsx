'use client';

import { useActionState } from 'react';
import { reinscrireAction } from './actions';
import type { EtatActionEspace } from './types';

export function BoutonReinscrire() {
  const [etat, envoyer] = useActionState(reinscrireAction, {} as EtatActionEspace);

  return (
    <form action={envoyer} className="flex flex-col gap-2">
      {etat.erreur ? (
        <p role="alert" className="text-[color:var(--gris-800)]">
          {etat.erreur}
        </p>
      ) : null}
      <button
        type="submit"
        className="min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Me réinscrire
      </button>
    </form>
  );
}
