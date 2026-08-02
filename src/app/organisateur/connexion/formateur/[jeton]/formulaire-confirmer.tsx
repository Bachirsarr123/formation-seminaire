'use client';

import { useActionState } from 'react';
import { confirmerLienMagiqueAction, type EtatConfirmerLienMagique } from './actions';

const ETAT_INITIAL: EtatConfirmerLienMagique = {};

export function FormulaireConfirmer({ jeton }: { jeton: string }) {
  const [etat, envoyer] = useActionState(confirmerLienMagiqueAction, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
      <button
        type="submit"
        className="min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Accéder à mon espace
      </button>
    </form>
  );
}
