'use client';

import { useActionState, useEffect, useState } from 'react';
import { regenererJetonAction, type EtatRegenerationJeton } from './actions';

const ETAT_INITIAL: EtatRegenerationJeton = {};

export function BoutonRegenererJeton({ seminaireId, inscriptionId }: { seminaireId: string; inscriptionId: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const action = regenererJetonAction.bind(null, seminaireId, inscriptionId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  // Cette action ne redirige pas (contrairement à la suppression, qui démonte
  // l'encart en quittant la page) : sans ce reset explicite sur une nouvelle
  // référence d'état, l'encart de confirmation resterait affiché après coup.
  useEffect(() => {
    if (etat.fait) setConfirmation(false);
  }, [etat]);

  if (confirmation) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="text-[color:var(--gris-800)]">Régénérer le jeton de ce participant ?</p>
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          L&apos;ancien lien personnel cessera immédiatement de fonctionner, y compris s&apos;il a été transféré ou mis
          en favori par le participant.
        </p>
        <div className="flex gap-3">
          <form action={envoyer}>
            <button
              type="submit"
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
            >
              Oui, régénérer
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
      className="min-h-[44px] bg-transparent text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
    >
      Régénérer le jeton
    </button>
  );
}
