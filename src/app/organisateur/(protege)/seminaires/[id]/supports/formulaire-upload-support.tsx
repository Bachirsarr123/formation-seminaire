'use client';

import { useActionState, useId } from 'react';
import type { EtatUploadSupport } from './actions';

const ETAT_INITIAL: EtatUploadSupport = {};

interface Props {
  action: (etat: EtatUploadSupport, formData: FormData) => Promise<EtatUploadSupport>;
}

export function FormulaireUploadSupport({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  return (
    // Pas d'encType explicite : React le déduit lui-même pour une
    // action-fonction dès qu'un input file est présent (même remarque que
    // FormulaireImportCsv).
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Ajouter un support</h2>

      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-titre`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Titre (facultatif — par défaut, le nom du fichier)
        </label>
        <input id={`${idBase}-titre`} type="text" name="titre" placeholder="Support de présentation" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-fichier`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Fichier — PDF, PPTX, DOCX, XLSX ou image, 10 Mo maximum
        </label>
        <input
          id={`${idBase}-fichier`}
          type="file"
          name="fichier"
          accept=".pdf,.pptx,.docx,.xlsx,image/*"
          required
        />
      </div>

      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        Téléverser
      </button>
    </form>
  );
}
