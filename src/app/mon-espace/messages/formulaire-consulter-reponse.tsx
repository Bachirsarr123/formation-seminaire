'use client';

import { useActionState } from 'react';
import { LIBELLE_STATUT_MESSAGE } from '@/lib/libelles';
import type { EtatConsultationMessage } from './actions';

const ETAT_INITIAL: EtatConsultationMessage = {};

interface Props {
  action: (etat: EtatConsultationMessage, formData: FormData) => Promise<EtatConsultationMessage>;
}

export function FormulaireConsulterReponse({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  return (
    <div className="flex flex-col gap-3">
      <form action={envoyer} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="codeSuivi" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Code de suivi
          </label>
          <input id="codeSuivi" type="text" name="codeSuivi" required />
        </div>
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Consulter
        </button>
      </form>

      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      {etat.reponse ? (
        <div className="flex flex-col gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            Votre message — {LIBELLE_STATUT_MESSAGE[etat.reponse.statut]}
          </p>
          <p className="text-[color:var(--gris-800)]">{etat.reponse.contenu}</p>
          {etat.reponse.reponseOrganisateur ? (
            <p className="text-[color:var(--gris-900)]">
              <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Réponse : </span>
              {etat.reponse.reponseOrganisateur}
            </p>
          ) : (
            <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Pas encore de réponse.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
