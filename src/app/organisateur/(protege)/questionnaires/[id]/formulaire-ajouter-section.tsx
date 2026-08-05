'use client';

import { useActionState } from 'react';
import { ajouterSectionAction, type EtatFormulaireEditeur } from './actions';

const ETAT_INITIAL: EtatFormulaireEditeur = {};

// Toujours visible, jamais masquée derrière un bouton "+" qui dépendrait de
// JavaScript pour se révéler — contrairement à FormulaireCreerModele
// (bibliothèque), CET écran doit rester utilisable sans JS (critère
// d'acceptation du lot). useActionState fonctionne nativement sans JS :
// sans lui, le navigateur fait un simple POST, Next renvoie la page entière.
export function FormulaireAjouterSection({ questionnaireId }: { questionnaireId: string }) {
  const action = ajouterSectionAction.bind(null, questionnaireId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Ajouter une section</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="titre-section" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Titre
        </label>
        <input id="titre-section" type="text" name="titre" required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="description-section" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Description (facultative)
        </label>
        <textarea id="description-section" name="description" rows={2} />
      </div>
      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        + Ajouter la section
      </button>
      {etat.erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
