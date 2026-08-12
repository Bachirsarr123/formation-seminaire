'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { NOM_CHAMP_HONEYPOT } from '@/lib/anti-spam-honeypot';
import { restaurer, sauvegarder } from '@/lib/client/sauvegarde-locale';
import { Champ } from './champ';
import type { EtatFormulaireInscription, ValeursFormulaireInscription } from './types';

const CLE_BROUILLON = 'inscription-brouillon';
const VALEURS_VIDES: ValeursFormulaireInscription = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  fonction: '',
};

interface Props {
  action: (etat: EtatFormulaireInscription, formData: FormData) => Promise<EtatFormulaireInscription>;
  jetonFormulaire: { timestamp: string; signature: string };
  texteInformation: string;
  texteCommunications: string;
  texteEmployeur: string;
}

export function FormulaireInscription({
  action,
  jetonFormulaire,
  texteInformation,
  texteCommunications,
  texteEmployeur,
}: Props) {
  const [etat, envoyer] = useActionState(action, {} as EtatFormulaireInscription);
  const [brouillonRestaure, setBrouillonRestaure] = useState<ValeursFormulaireInscription | null>(null);

  // Restauration au premier rendu uniquement, et seulement si le serveur n'a
  // pas déjà renvoyé des valeurs (cas d'une erreur de validation : les
  // valeurs soumises priment sur un ancien brouillon local).
  useEffect(() => {
    if (!etat.valeurs) {
      setBrouillonRestaure(restaurer<ValeursFormulaireInscription>(CLE_BROUILLON));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valeurs = etat.valeurs ?? brouillonRestaure ?? VALEURS_VIDES;

  function surModification(evenement: React.FormEvent<HTMLFormElement>) {
    const donnees = new FormData(evenement.currentTarget);
    sauvegarder<ValeursFormulaireInscription>(CLE_BROUILLON, {
      prenom: String(donnees.get('prenom') ?? ''),
      nom: String(donnees.get('nom') ?? ''),
      email: String(donnees.get('email') ?? ''),
      telephone: String(donnees.get('telephone') ?? ''),
      fonction: String(donnees.get('fonction') ?? ''),
    });
  }

  return (
    <form action={envoyer} onChange={surModification} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="jetonFormulaireTimestamp" value={jetonFormulaire.timestamp} />
      <input type="hidden" name="jetonFormulaireSignature" value={jetonFormulaire.signature} />

      {/* Honeypot : invisible et hors du parcours clavier pour un humain. */}
      <div className="leurre" aria-hidden="true">
        <label htmlFor={NOM_CHAMP_HONEYPOT}>Site web</label>
        <input type="text" id={NOM_CHAMP_HONEYPOT} name={NOM_CHAMP_HONEYPOT} tabIndex={-1} autoComplete="off" />
      </div>

      {etat.erreurGenerale ? (
        <p
          role="alert"
          className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-800)]"
        >
          {etat.erreurGenerale}
        </p>
      ) : null}

      <Champ label="Prénom" name="prenom" autoComplete="given-name" defaultValue={valeurs.prenom} erreur={etat.erreursChamps?.prenom} requis />
      <Champ label="Nom" name="nom" autoComplete="family-name" defaultValue={valeurs.nom} erreur={etat.erreursChamps?.nom} requis />
      <Champ
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={valeurs.email}
        erreur={etat.erreursChamps?.email}
      />
      <Champ
        label="Téléphone"
        name="telephone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+221 77 000 00 00"
        defaultValue={valeurs.telephone}
        erreur={etat.erreursChamps?.telephone}
      />
      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
        Renseignez au moins un e-mail ou un numéro de téléphone.
      </p>

      <Champ label="Fonction (optionnel)" name="fonction" autoComplete="organization-title" defaultValue={valeurs.fonction} />

      <hr className="border-[color:var(--gris-100)]" />

      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">{texteInformation}</p>

      <label className="flex items-start gap-2 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
        <input type="checkbox" name="communications" className="mt-1 h-5 w-5" />
        {texteCommunications}
      </label>
      <label className="flex items-start gap-2 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
        <input type="checkbox" name="partageEmployeur" className="mt-1 h-5 w-5" />
        {texteEmployeur}
      </label>

      <BoutonSoumettre />
    </form>
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
      {pending ? 'Inscription en cours…' : "Je m'inscris"}
    </button>
  );
}
