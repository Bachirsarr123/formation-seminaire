'use client';

import { useActionState, useId } from 'react';
import type { EtatUploadCv } from './actions';

const ETAT_INITIAL: EtatUploadCv = {};

interface Props {
  action: (etat: EtatUploadCv, formData: FormData) => Promise<EtatUploadCv>;
  aDejaUnCv: boolean;
}

export function FormulaireCvFormateur({ action, aDejaUnCv }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  return (
    <form action={envoyer} className="flex flex-wrap items-center gap-2">
      <label htmlFor={idBase} className="sr-only">
        CV (PDF, 5 Mo maximum)
      </label>
      <input id={idBase} type="file" name="cv" accept="application/pdf" required className="max-w-[180px] text-[length:var(--taille-sm)]" />
      <button
        type="submit"
        className="min-h-[36px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
      >
        {aDejaUnCv ? 'Remplacer' : 'Téléverser'}
      </button>
      {etat.erreur ? (
        <p role="alert" className="basis-full text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
