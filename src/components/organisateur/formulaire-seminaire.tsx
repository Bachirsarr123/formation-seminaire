'use client';

import { useActionState, useId, useState } from 'react';

export interface EtatFormulaireSeminaire {
  erreur?: string;
}

export const ETAT_INITIAL_FORMULAIRE_SEMINAIRE: EtatFormulaireSeminaire = {};

interface FormateurOption {
  id: string;
  nom: string;
  prenom: string;
}

interface ModuleInitial {
  titre: string;
  dureeMinutes: number;
}

interface FormateurInitial {
  utilisateurId: string;
  roleFormateur: 'PRINCIPAL' | 'INTERVENANT';
}

export interface ValeursInitialesSeminaire {
  titre: string;
  description: string | null;
  dateDebut: Date;
  dateFin: Date;
  lieu: string | null;
  tarif: string | null;
  modalite: string;
  dureeHeures: number;
  inscriptionOuverte: boolean;
  validationRequise: boolean;
  seuilAnonymat: number;
  modules: ModuleInitial[];
  formateurs: FormateurInitial[];
}

interface Props {
  action: (etatPrecedent: EtatFormulaireSeminaire, formData: FormData) => Promise<EtatFormulaireSeminaire>;
  formateursDisponibles: FormateurOption[];
  valeursInitiales?: ValeursInitialesSeminaire;
  libelleSoumission: string;
}

function versDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

interface LigneModule {
  cle: string;
  titre: string;
  dureeMinutes: string;
}

export function FormulaireSeminaire({ action, formateursDisponibles, valeursInitiales, libelleSoumission }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL_FORMULAIRE_SEMINAIRE);
  const idBase = useId();

  const [modules, setModules] = useState<LigneModule[]>(
    valeursInitiales && valeursInitiales.modules.length > 0
      ? valeursInitiales.modules.map((m, i) => ({ cle: `${idBase}-${i}`, titre: m.titre, dureeMinutes: String(m.dureeMinutes) }))
      : [{ cle: `${idBase}-0`, titre: '', dureeMinutes: '' }],
  );

  const principalInitial = valeursInitiales?.formateurs.find((f) => f.roleFormateur === 'PRINCIPAL')?.utilisateurId;
  const [formateursCoches, setFormateursCoches] = useState<Set<string>>(
    new Set(valeursInitiales?.formateurs.map((f) => f.utilisateurId) ?? []),
  );
  const [principal, setPrincipal] = useState<string>(principalInitial ?? '');

  function ajouterModule() {
    setModules((m) => [...m, { cle: `${idBase}-${Date.now()}`, titre: '', dureeMinutes: '' }]);
  }
  function retirerModule(cle: string) {
    setModules((m) => (m.length > 1 ? m.filter((l) => l.cle !== cle) : m));
  }

  return (
    <form action={envoyer} className="flex flex-col gap-6">
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="titre" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          Titre
        </label>
        <input id="titre" type="text" name="titre" required defaultValue={valeursInitiales?.titre} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
          Description
        </label>
        <textarea id="description" name="description" rows={3} defaultValue={valeursInitiales?.description ?? ''} />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="dateDebut" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Début
          </label>
          <input
            id="dateDebut"
            type="datetime-local"
            name="dateDebut"
            required
            defaultValue={valeursInitiales ? versDatetimeLocal(valeursInitiales.dateDebut) : undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dateFin" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Fin
          </label>
          <input
            id="dateFin"
            type="datetime-local"
            name="dateFin"
            required
            defaultValue={valeursInitiales ? versDatetimeLocal(valeursInitiales.dateFin) : undefined}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="lieu" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Lieu
          </label>
          <input id="lieu" type="text" name="lieu" defaultValue={valeursInitiales?.lieu ?? ''} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tarif" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Tarif
          </label>
          <input
            id="tarif"
            type="text"
            name="tarif"
            placeholder="Gratuit, 150 000 FCFA / participant, sur devis…"
            defaultValue={valeursInitiales?.tarif ?? ''}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="modalite" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Modalité
          </label>
          <select id="modalite" name="modalite" required defaultValue={valeursInitiales?.modalite ?? 'PRESENTIEL'}>
            <option value="PRESENTIEL">Présentiel</option>
            <option value="DISTANCIEL">Distanciel</option>
            <option value="HYBRIDE">Hybride</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dureeHeures" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Durée (heures)
          </label>
          <input
            id="dureeHeures"
            type="number"
            name="dureeHeures"
            min="0.5"
            step="0.5"
            required
            defaultValue={valeursInitiales?.dureeHeures}
          />
        </div>
      </div>

      {/* Uniquement à la création : en édition, le logo client a son propre
          widget indépendant (page Modifier) qui remplace immédiatement le
          fichier sans passer par ce formulaire — voir
          seminaires/[id]/modifier/formulaire-logo-client.tsx. */}
      {!valeursInitiales ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="logoClient" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Logo de l&apos;entreprise cliente (image, 2 Mo maximum)
          </label>
          <input id="logoClient" type="file" name="logoClient" accept="image/*" />
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">Modules</legend>
        {modules.map((ligne, index) => (
          <div key={ligne.cle} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={`module-titre-${ligne.cle}`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                Titre du module {index + 1}
              </label>
              <input
                id={`module-titre-${ligne.cle}`}
                type="text"
                name="moduleTitre"
                defaultValue={ligne.titre}
              />
            </div>
            <div className="flex w-32 flex-col gap-1">
              <label htmlFor={`module-duree-${ligne.cle}`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                Durée (min)
              </label>
              <input id={`module-duree-${ligne.cle}`} type="number" name="moduleDuree" min="0" defaultValue={ligne.dureeMinutes} />
            </div>
            <button
              type="button"
              onClick={() => retirerModule(ligne.cle)}
              className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[color:var(--gris-700)]"
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={ajouterModule}
          className="self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 py-2 text-[color:var(--gris-800)]"
        >
          + Ajouter un module
        </button>
      </fieldset>

      {formateursDisponibles.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Aucun formateur dans l&apos;équipe.{' '}
          <a href="/organisateur/equipe" className="underline">
            Ajouter un formateur
          </a>
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">Formateurs</legend>
          {formateursDisponibles.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  name="formateurId"
                  value={f.id}
                  defaultChecked={formateursCoches.has(f.id)}
                  onChange={(e) => {
                    setFormateursCoches((prev) => {
                      const suivant = new Set(prev);
                      if (e.target.checked) suivant.add(f.id);
                      else suivant.delete(f.id);
                      return suivant;
                    });
                    if (!e.target.checked && principal === f.id) setPrincipal('');
                  }}
                />
                {f.prenom} {f.nom}
              </label>
              {formateursCoches.has(f.id) ? (
                <label className="flex items-center gap-1 text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  <input
                    type="radio"
                    name="formateurPrincipal"
                    value={f.id}
                    checked={principal === f.id}
                    onChange={() => setPrincipal(f.id)}
                  />
                  Principal
                </label>
              ) : null}
            </div>
          ))}
        </fieldset>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="seuilAnonymat" className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
            Seuil d&apos;anonymat
          </label>
          <input
            id="seuilAnonymat"
            type="number"
            name="seuilAnonymat"
            min="1"
            step="1"
            defaultValue={valeursInitiales?.seuilAnonymat ?? 5}
            className="w-32"
          />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="inscriptionOuverte" defaultChecked={valeursInitiales?.inscriptionOuverte ?? false} />
          Inscriptions ouvertes
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="validationRequise" defaultChecked={valeursInitiales?.validationRequise ?? false} />
          Validation manuelle requise avant confirmation
        </label>
      </div>

      <button
        type="submit"
        className="mt-2 min-h-[56px] self-start rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        {libelleSoumission}
      </button>
    </form>
  );
}
