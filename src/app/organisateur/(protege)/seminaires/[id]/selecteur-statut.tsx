'use client';

import { useActionState } from 'react';
import { StatutSeminaire } from '@prisma/client';
import { LIBELLE_STATUT_SEMINAIRE } from '@/lib/libelles';
import { changerStatutSeminaireAction, type EtatChangementStatut } from './actions';

const ETAT_INITIAL: EtatChangementStatut = {};

export function SelecteurStatut({ seminaireId, statutActuel }: { seminaireId: string; statutActuel: StatutSeminaire }) {
  const action = changerStatutSeminaireAction.bind(null, seminaireId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="statut" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Statut
        </label>
        <select id="statut" name="statut" defaultValue={statutActuel}>
          {Object.values(StatutSeminaire).map((s) => (
            <option key={s} value={s}>
              {LIBELLE_STATUT_SEMINAIRE[s]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
      >
        Changer le statut
      </button>
      {etat.erreur ? (
        <p role="alert" className="w-full text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
