'use client';

import { useActionState } from 'react';
import type { EtatEnvoiMessage } from './actions';
import { BoutonCopier } from './bouton-copier';

const ETAT_INITIAL: EtatEnvoiMessage = {};

interface Props {
  action: (etat: EtatEnvoiMessage, formData: FormData) => Promise<EtatEnvoiMessage>;
}

// Une fois le code affiché, le formulaire disparaît définitivement (pas de
// bouton « envoyer un autre message ») : forcer un rechargement de page pour
// en envoyer un second évite qu'un state client périmé fasse croire que le
// code affiché correspond encore au dernier envoi.
export function FormulaireEnvoyerMessage({ action }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  if (etat.code) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="text-[color:var(--gris-800)]">
          Message envoyé. Notez ce code pour revenir consulter une éventuelle réponse — il ne sera plus jamais
          affiché.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="chiffre break-all text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{etat.code}</p>
          <BoutonCopier valeur={etat.code} />
        </div>
      </div>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-2">
      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
      <textarea name="contenu" rows={4} placeholder="Votre message, à l'attention de l'organisateur" required />
      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        Envoyer
      </button>
    </form>
  );
}
