'use client';

import { useActionState } from 'react';
import {
  confirmerImportAction,
  previsualiserImportAction,
  type EtatConfirmationImport,
  type EtatPreviewImport,
} from './actions';

const ETAT_PREVIEW_INITIAL: EtatPreviewImport = {};
const ETAT_CONFIRM_INITIAL: EtatConfirmationImport = {};

export function FormulaireImportCsv({ seminaireId }: { seminaireId: string }) {
  const previsualiser = previsualiserImportAction.bind(null, seminaireId);
  const [etatPreview, envoyerPreview] = useActionState(previsualiser, ETAT_PREVIEW_INITIAL);

  const confirmer = confirmerImportAction.bind(null, seminaireId);
  const [etatConfirm, envoyerConfirm] = useActionState(confirmer, ETAT_CONFIRM_INITIAL);

  if (etatConfirm.succes) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="text-[color:var(--gris-900)]">
          {etatConfirm.importes} participant{(etatConfirm.importes ?? 0) > 1 ? 's' : ''} importé
          {(etatConfirm.importes ?? 0) > 1 ? 's' : ''}
          {etatConfirm.dejaInscrits ? `, ${etatConfirm.dejaInscrits} déjà inscrit(s) ignoré(s)` : ''}.
        </p>
        <a href={`/organisateur/seminaires/${seminaireId}/participants`} className="text-[color:var(--gris-700)] underline">
          Retour à la liste des participants
        </a>
      </div>
    );
  }

  const rapport = etatPreview.rapport;

  return (
    <div className="flex flex-col gap-6">
      {/* Pas d'encType explicite : React le déduit et le gère lui-même pour
          une action-fonction dès qu'un input file est présent — le préciser
          manuellement ici déclenche un avertissement React (il serait de
          toute façon écrasé). */}
      <form action={envoyerPreview} className="flex flex-col gap-3">
        <label htmlFor="fichier" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Fichier CSV
        </label>
        <input id="fichier" type="file" name="fichier" accept=".csv,text/csv" required />
        <button
          type="submit"
          className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Prévisualiser
        </button>
        {etatPreview.erreurGlobale ? (
          <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
            {etatPreview.erreurGlobale}
          </p>
        ) : null}
      </form>

      {rapport ? (
        <section className="flex flex-col gap-4">
          <p className="text-[color:var(--gris-800)]">
            {rapport.totalLignes} ligne{rapport.totalLignes > 1 ? 's' : ''} de données, dont {rapport.lignesValides.length}{' '}
            valide{rapport.lignesValides.length > 1 ? 's' : ''} à importer.
          </p>

          {rapport.erreurs.length > 0 ? (
            <div>
              <h2 className="mb-1 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
                Erreurs ({rapport.erreurs.length})
              </h2>
              <ul className="flex flex-col gap-1 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
                {rapport.erreurs.map((e) => (
                  <li key={e.numeroLigne}>
                    Ligne {e.numeroLigne} : {e.motif}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rapport.doublonsFichier.length > 0 ? (
            <div>
              <h2 className="mb-1 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
                Doublons dans le fichier ({rapport.doublonsFichier.length})
              </h2>
              <ul className="flex flex-col gap-1 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
                {rapport.doublonsFichier.map((d) => (
                  <li key={d.numeroLigne}>
                    Ligne {d.numeroLigne} : même contact que la ligne {d.premiereOccurrenceLigne}, ignorée
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rapport.dejaInscrites.length > 0 ? (
            <div>
              <h2 className="mb-1 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
                Déjà inscrits à ce séminaire ({rapport.dejaInscrites.length})
              </h2>
              <ul className="flex flex-col gap-1 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
                {rapport.dejaInscrites.map((d) => (
                  <li key={d.numeroLigne}>
                    Ligne {d.numeroLigne} : {d.prenom} {d.nom}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rapport.apercuId ? (
            <form action={envoyerConfirm} className="flex flex-col gap-2">
              <input type="hidden" name="apercuId" value={rapport.apercuId} />
              <button
                type="submit"
                className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
              >
                Confirmer l&apos;import de {rapport.lignesValides.length} participant
                {rapport.lignesValides.length > 1 ? 's' : ''}
              </button>
              {etatConfirm.erreur ? (
                <p role="alert" className="text-[length:var(--taille-sm)] text-[color:#b3261e]">
                  {etatConfirm.erreur}
                </p>
              ) : null}
            </form>
          ) : (
            <p className="text-[color:var(--gris-700)]">Aucune ligne valide à importer.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
