'use client';

import { useState } from 'react';
import { annulerInscriptionAction } from './actions';

export function BoutonAnnuler() {
  const [confirmation, setConfirmation] = useState(false);

  if (confirmation) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="text-[color:var(--gris-800)]">Annuler votre inscription ?</p>
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Vous pourrez vous réinscrire à tout moment avec le même lien.
        </p>
        <div className="flex gap-3">
          <form action={annulerInscriptionAction}>
            <button
              type="submit"
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
            >
              Oui, annuler
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmation(false)}
            className="min-h-[44px] rounded-[var(--rayon-sm)] bg-transparent px-4 text-[color:var(--gris-700)] underline"
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
      className="min-h-[44px] self-start bg-transparent text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
    >
      Annuler mon inscription
    </button>
  );
}
