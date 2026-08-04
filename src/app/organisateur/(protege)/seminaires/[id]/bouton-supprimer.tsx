'use client';

import { useState } from 'react';
import { supprimerSeminaireAction } from './actions';

export function BoutonSupprimer({ seminaireId }: { seminaireId: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const action = supprimerSeminaireAction.bind(null, seminaireId);

  if (confirmation) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="text-[color:var(--gris-800)]">Supprimer ce séminaire ?</p>
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Suppression logique uniquement : les inscriptions et réponses restent conservées, mais le séminaire
          n&apos;apparaîtra plus dans les listes ni sur sa page publique.
        </p>
        <div className="flex gap-3">
          <form action={action}>
            <button
              type="submit"
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
            >
              Oui, supprimer
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
      Supprimer
    </button>
  );
}
