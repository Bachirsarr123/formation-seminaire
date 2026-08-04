'use client';

import { useState } from 'react';
import { desactiverCompteAction } from './actions';

export function BoutonDesactiver({ utilisateurId }: { utilisateurId: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const action = desactiverCompteAction.bind(null, utilisateurId);

  if (confirmation) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">Désactiver ce compte ?</p>
        <div className="flex gap-2">
          <form action={action}>
            <button
              type="submit"
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-3 text-[color:var(--gris-000)]"
            >
              Oui, désactiver
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmation(false)}
            className="min-h-[44px] rounded-[var(--rayon-sm)] bg-transparent px-3 text-[color:var(--gris-700)] underline"
          >
            Non, revenir
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmation(true)}
      className="min-h-[44px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
    >
      Désactiver
    </button>
  );
}
