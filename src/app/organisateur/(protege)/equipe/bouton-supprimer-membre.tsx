'use client';

import { useActionState, useState } from 'react';
import { supprimerMembreAction, type EtatSuppressionMembre } from './actions';

const ETAT_INITIAL: EtatSuppressionMembre = {};

export function BoutonSupprimerMembre({ utilisateurId }: { utilisateurId: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const action = supprimerMembreAction.bind(null, utilisateurId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  if (confirmation) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Supprimer définitivement ce compte ?
        </p>
        <div className="flex gap-2">
          <form action={envoyer}>
            <button
              type="submit"
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:#b3261e] px-3 text-[color:var(--gris-000)]"
            >
              Oui, supprimer
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
        {etat.erreur ? (
          <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
            {etat.erreur}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmation(true)}
      className="min-h-[44px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:#b3261e] underline"
    >
      Supprimer
    </button>
  );
}
