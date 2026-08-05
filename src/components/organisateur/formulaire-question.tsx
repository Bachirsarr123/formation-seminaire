'use client';

import { useActionState, useId } from 'react';
import { LIBELLE_TYPE_QUESTION } from '@/lib/libelles';

export interface EtatFormulaireQuestion {
  erreur?: string;
}

export const ETAT_INITIAL_FORMULAIRE_QUESTION: EtatFormulaireQuestion = {};

interface ModuleOption {
  id: string;
  titre: string;
}

export interface ValeursInitialesQuestion {
  intitule: string;
  description: string | null;
  type: string;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  moduleId: string | null;
  options: unknown;
}

interface Props {
  action: (etatPrecedent: EtatFormulaireQuestion, formData: FormData) => Promise<EtatFormulaireQuestion>;
  modulesDisponibles: ModuleOption[];
  valeursInitiales?: ValeursInitialesQuestion;
  libelleSoumission: string;
}

const TYPES_QUESTION = Object.keys(LIBELLE_TYPE_QUESTION) as (keyof typeof LIBELLE_TYPE_QUESTION)[];
const NB_CHOIX_QCM = 8;
const NIVEAUX_ECHELLE_4 = ['1', '2', '3', '4'] as const;

function choixInitiaux(options: unknown): string[] {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
  const choix = (options as Record<string, unknown>).choix;
  if (!Array.isArray(choix)) return [];
  return choix.map((c) => (c && typeof c === 'object' && 'libelle' in c ? String((c as { libelle: unknown }).libelle) : ''));
}

function libellesEchelleInitiaux(options: unknown): Partial<Record<'1' | '2' | '3' | '4', string>> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
  const libelles = (options as Record<string, unknown>).libelles;
  if (!libelles || typeof libelles !== 'object' || Array.isArray(libelles)) return {};
  return libelles as Partial<Record<'1' | '2' | '3' | '4', string>>;
}

/**
 * Un seul formulaire pour tous les types de question, réutilisé pour
 * « ajouter » (inline, par section) et « modifier » (page dédiée) — même
 * philosophie que FormulaireSeminaire. Les champs propres à un type (choix
 * QCM, niveaux d'échelle) sont TOUJOURS affichés, jamais masqués par JS :
 * un ajout/masquage dynamique dépendrait de JavaScript, ce que l'éditeur ne
 * peut pas exiger (critère d'acceptation du lot). analyserFormulaireQuestion
 * (lib/organisateur/formulaire-editeur-questionnaire.ts) ne lit que le bloc
 * pertinent pour le `type` réellement soumis.
 */
export function FormulaireQuestion({ action, modulesDisponibles, valeursInitiales, libelleSoumission }: Props) {
  const [etat, envoyer] = useActionState(action, ETAT_INITIAL_FORMULAIRE_QUESTION);
  const idBase = useId();
  const choixInit = choixInitiaux(valeursInitiales?.options);
  const echelleInit = libellesEchelleInitiaux(valeursInitiales?.options);

  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      {etat.erreur ? (
        <p role="alert" className="text-[color:#b3261e]">
          {etat.erreur}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-intitule`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Intitulé
        </label>
        <input id={`${idBase}-intitule`} type="text" name="intitule" required defaultValue={valeursInitiales?.intitule} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idBase}-description`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          Description (facultative)
        </label>
        <textarea id={`${idBase}-description`} name="description" rows={2} defaultValue={valeursInitiales?.description ?? ''} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-type`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Type
          </label>
          <select id={`${idBase}-type`} name="type" required defaultValue={valeursInitiales?.type ?? 'NOTE_5'}>
            {TYPES_QUESTION.map((type) => (
              <option key={type} value={type}>
                {LIBELLE_TYPE_QUESTION[type]}
              </option>
            ))}
          </select>
        </div>
        {modulesDisponibles.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idBase}-module`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
              Module rattaché (facultatif)
            </label>
            <select id={`${idBase}-module`} name="moduleId" defaultValue={valeursInitiales?.moduleId ?? ''}>
              <option value="">Aucun</option>
              {modulesDisponibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titre}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="obligatoire" defaultChecked={valeursInitiales?.obligatoire ?? false} />
          Réponse obligatoire
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="autoriseSansOpinion" defaultChecked={valeursInitiales?.autoriseSansOpinion ?? false} />
          Autoriser « Sans opinion » (questions à échelle uniquement)
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-[var(--rayon-sm)] border border-[color:var(--gris-100)] p-3">
        <legend className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Choix (uniquement si le type est « Choix unique » ou « Choix multiple »)
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: NB_CHOIX_QCM }, (_, i) => i + 1).map((n) => (
            <input
              key={n}
              type="text"
              name={`choixLibelle${n}`}
              placeholder={`Choix ${n}`}
              defaultValue={choixInit[n - 1] ?? ''}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-[var(--rayon-sm)] border border-[color:var(--gris-100)] p-3">
        <legend className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Niveaux (uniquement si le type est « Échelle à 4 niveaux »)
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NIVEAUX_ECHELLE_4.map((niveau) => (
            <input
              key={niveau}
              type="text"
              name={`echelleLibelle${niveau}`}
              placeholder={`Niveau ${niveau}`}
              defaultValue={echelleInit[niveau] ?? ''}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
      >
        {libelleSoumission}
      </button>
    </form>
  );
}
