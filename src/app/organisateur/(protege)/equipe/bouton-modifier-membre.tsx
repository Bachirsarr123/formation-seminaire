'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { modifierMembreAction, type EtatModificationMembre } from './actions';

const ETAT_INITIAL: EtatModificationMembre = {};

interface Props {
  utilisateurId: string;
  nom: string;
  prenom: string;
  email: string;
}

export function BoutonModifierMembre({ utilisateurId, nom, prenom, email }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const action = modifierMembreAction.bind(null, utilisateurId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);
  const idBase = useId();

  // Même garde que les formulaires de création : dépend de l'objet `etat`
  // entier, pas de `etat.succes` seul — sinon rouvrir après une première
  // modification réussie le refermerait aussitôt sans nouvelle soumission.
  useEffect(() => {
    if (etat.succes) setOuvert(false);
  }, [etat]);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="min-h-[44px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
      >
        Modifier
      </button>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-nom`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Nom
        </label>
        <input id={`${idBase}-nom`} type="text" name="nom" defaultValue={nom} required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-prenom`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Prénom
        </label>
        <input id={`${idBase}-prenom`} type="text" name="prenom" defaultValue={prenom} required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-email`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          E-mail
        </label>
        <input id={`${idBase}-email`} type="email" name="email" defaultValue={email} required />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-[36px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-000)]"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="min-h-[36px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-700)] underline"
        >
          Annuler
        </button>
      </div>

      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
