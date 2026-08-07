'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { NOM_CHAMP_HONEYPOT } from '@/lib/anti-spam-honeypot';
import { QuestionRecueil, type RecueilQuestionAAfficher } from './question-recueil';
import type { EtatFormulaireRecueil, ValeursFormulaireRecueil } from './types';

const VALEURS_VIDES: ValeursFormulaireRecueil = { prenom: '', nom: '', fonction: '', organisation: '' };

interface Props {
  action: (etat: EtatFormulaireRecueil, formData: FormData) => Promise<EtatFormulaireRecueil>;
  jetonFormulaire: { timestamp: string; signature: string };
  questions: RecueilQuestionAAfficher[];
}

export function FormulaireRecueil({ action, jetonFormulaire, questions }: Props) {
  const [etat, envoyer] = useActionState(action, {} as EtatFormulaireRecueil);
  const valeurs = etat.valeurs ?? VALEURS_VIDES;

  return (
    <form action={envoyer} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="jetonFormulaireTimestamp" value={jetonFormulaire.timestamp} />
      <input type="hidden" name="jetonFormulaireSignature" value={jetonFormulaire.signature} />

      {/* Honeypot : invisible et hors du parcours clavier pour un humain. */}
      <div className="leurre" aria-hidden="true">
        <label htmlFor={NOM_CHAMP_HONEYPOT}>Site web</label>
        <input type="text" id={NOM_CHAMP_HONEYPOT} name={NOM_CHAMP_HONEYPOT} tabIndex={-1} autoComplete="off" />
      </div>

      {etat.erreurGenerale ? (
        <p role="alert" className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-800)]">
          {etat.erreurGenerale}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-[length:var(--taille-sm)] uppercase tracking-wide text-[color:var(--gris-600)]">
          Vos coordonnées
        </h2>

        <ChampTexte label="Prénom" name="prenom" autoComplete="given-name" defaultValue={valeurs.prenom} erreur={etat.erreursChamps?.prenom} requis />
        <ChampTexte label="Nom" name="nom" autoComplete="family-name" defaultValue={valeurs.nom} erreur={etat.erreursChamps?.nom} requis />
        <ChampTexte label="Fonction (facultatif)" name="fonction" autoComplete="organization-title" defaultValue={valeurs.fonction} />
        <ChampTexte label="Organisation (facultatif)" name="organisation" autoComplete="organization" defaultValue={valeurs.organisation} />
      </section>

      {questions.length > 0 ? (
        <section className="flex flex-col gap-5">
          <h2 className="text-[length:var(--taille-sm)] uppercase tracking-wide text-[color:var(--gris-600)]">
            Questions
          </h2>
          {questions.map((question, index) => (
            <QuestionRecueil key={question.id} question={question} numero={index + 1} />
          ))}
        </section>
      ) : null}

      <BoutonSoumettre />
    </form>
  );
}

function ChampTexte({
  label,
  name,
  autoComplete,
  defaultValue,
  erreur,
  requis,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  defaultValue?: string;
  erreur?: string;
  requis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={requis}
        aria-invalid={erreur ? true : undefined}
      />
      {erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[color:var(--gris-900)]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

function BoutonSoumettre() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)] disabled:opacity-70"
    >
      {pending ? 'Envoi en cours…' : 'Envoyer'}
    </button>
  );
}
