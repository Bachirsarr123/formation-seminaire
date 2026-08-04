'use client';

import { useActionState, useEffect, useState } from 'react';
import { ajouterParticipantAction, type EtatFormulaireParticipant } from './actions';

const ETAT_INITIAL: EtatFormulaireParticipant = {};

export function FormulaireAjoutParticipant({ seminaireId }: { seminaireId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const action = ajouterParticipantAction.bind(null, seminaireId);
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL);

  // Dépend de l'objet `etat` entier (nouvelle référence à chaque soumission
  // aboutie), pas de `etat.succes` seul : si on dépendait juste du booléen,
  // rouvrir le formulaire après un premier ajout réussi le refermerait
  // aussitôt, sans qu'aucune nouvelle soumission n'ait eu lieu.
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
        + Ajouter un participant
      </button>
    );
  }

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="nom" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Nom
          </label>
          <input id="nom" type="text" name="nom" required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prenom" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Prénom
          </label>
          <input id="prenom" type="text" name="prenom" required />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Email
          </label>
          <input id="email" type="email" name="email" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="telephone" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Téléphone
          </label>
          <input id="telephone" type="tel" name="telephone" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fonction" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Fonction
          </label>
          <input id="fonction" type="text" name="fonction" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="organisation" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Organisation
          </label>
          <input id="organisation" type="text" name="organisation" />
        </div>
      </div>

      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
        Ajouté directement en confirmé, sans passer par la validation.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
        >
          Ajouter
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
