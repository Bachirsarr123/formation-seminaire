'use client';

import { useActionState, useId } from 'react';
import type { EtatUploadLogoClient } from './actions';

const ETAT_INITIAL: EtatUploadLogoClient = {};

interface Props {
  action: (etat: EtatUploadLogoClient, formData: FormData) => Promise<EtatUploadLogoClient>;
  aDejaUnLogo: boolean;
}

export function FormulaireLogoClient({ action, aDejaUnLogo }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  return (
    <form action={envoyer} className="flex flex-wrap items-center gap-2">
      <label htmlFor={idBase} className="sr-only">
        Logo de l&apos;entreprise cliente (image, 2 Mo maximum)
      </label>
      <input
        id={idBase}
        type="file"
        name="logoClient"
        accept="image/*"
        required
        className="max-w-[220px] text-[length:var(--taille-sm)]"
      />
      <button
        type="submit"
        className="min-h-[36px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
      >
        {aDejaUnLogo ? 'Remplacer' : 'Téléverser'}
      </button>
      {etat.erreur ? (
        <p role="alert" className="basis-full text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
