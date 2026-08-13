'use client';

import { useActionState, useEffect, useState } from 'react';
import { creerOrganisateurAction, type EtatFormulaireFormateur } from './actions';

const ETAT_INITIAL: EtatFormulaireFormateur = {};

export function FormulaireCreerOrganisateur() {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer] = useActionState(creerOrganisateurAction, ETAT_INITIAL);

  // Même garde que FormulaireCreerFormateur : dépend de l'objet `etat` entier
  // (nouvelle référence à chaque soumission aboutie), pas de `etat.succes`
  // seul — sinon rouvrir le formulaire après une première création réussie
  // le refermerait aussitôt sans nouvelle soumission.
  useEffect(() => {
    if (etat.succes) setOuvert(false);
  }, [etat]);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
      >
        + Ajouter un organisateur
      </button>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="nom-orga" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Nom
          </label>
          <input id="nom-orga" type="text" name="nom" required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prenom-orga" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Prénom
          </label>
          <input id="prenom-orga" type="text" name="prenom" required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email-orga" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            E-mail
          </label>
          <input id="email-orga" type="email" name="email" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="motDePasse-orga" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Mot de passe (12 caractères minimum)
          </label>
          <input id="motDePasse-orga" type="password" name="motDePasse" autoComplete="new-password" minLength={12} required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirmation-orga" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Confirmer le mot de passe
          </label>
          <input id="confirmation-orga" type="password" name="confirmation" autoComplete="new-password" minLength={12} required />
        </div>
      </div>

      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
        Ce compte se connecte avec cette adresse et ce mot de passe, comme le vôtre.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-transparent px-4 text-[color:var(--gris-700)] underline"
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
