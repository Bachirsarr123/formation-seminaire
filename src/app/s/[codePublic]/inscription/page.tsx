import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { chargerSeminairePublic } from '@/lib/seminaire-public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { texteConsentement } from '@/lib/consentement/textes';
import { inscrireAction } from './actions';
import { FormulaireInscription } from './formulaire-inscription';

interface Props {
  params: Promise<{ codePublic: string }>;
}

export default async function PageInscription({ params }: Props) {
  const { codePublic } = await params;
  const resultat = await chargerSeminairePublic(codePublic);

  // Séminaire inconnu, ou pas dans l'état permettant l'inscription : la page
  // publique montre déjà le bon message (complet, fermé, terminé...), pas la
  // peine de le dupliquer ici.
  if (!resultat || resultat.etat.type !== 'OUVERTE') {
    redirect(`/s/${codePublic}`);
  }

  const { seminaire } = resultat;
  const jetons = deriverJetonsAccent(seminaire.cabinet.couleurPrimaire);
  const jetonFormulaire = genererJetonFormulaire();

  const texteInformation = texteConsentement('INSCRIPTION_EVALUATION');
  const texteCommunications = texteConsentement('COMMUNICATIONS');
  const texteEmployeur = texteConsentement('PARTAGE_EMPLOYEUR');

  return (
    <main style={stylesJetonsAccent(jetons) as CSSProperties} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <header className="flex flex-col gap-1">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Vous vous inscrivez à</p>
        <h1 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{seminaire.titre}</h1>
        <p className="text-[color:var(--gris-600)]">
          {formaterDateLongue(seminaire.dateDebut)} · {formaterHeure(seminaire.dateDebut)}–{formaterHeure(seminaire.dateFin)}
          {seminaire.lieu ? ` · ${seminaire.lieu}` : ''}
        </p>
      </header>

      <FormulaireInscription
        action={inscrireAction.bind(null, codePublic)}
        jetonFormulaire={jetonFormulaire}
        texteInformation={`${texteInformation.texte} ${texteInformation.dureeConservation}`}
        texteCommunications={texteCommunications.texte}
        texteEmployeur={texteEmployeur.texte}
      />
    </main>
  );
}
