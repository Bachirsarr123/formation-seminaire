'use client';

import { useActionState } from 'react';
import type { EtatReponseMessage } from './actions';

const ETAT_INITIAL: EtatReponseMessage = {};

interface Props {
  action: (etat: EtatReponseMessage, formData: FormData) => Promise<EtatReponseMessage>;
}

export function FormulaireReponseMessage({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-2">
      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
      <textarea name="reponse" rows={3} placeholder="Votre réponse, visible par l'auteur via son code de suivi" required />
      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        Répondre
      </button>
    </form>
  );
}
