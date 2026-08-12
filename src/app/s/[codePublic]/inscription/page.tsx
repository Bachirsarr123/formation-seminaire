import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { chargerSeminairePublic } from '@/lib/seminaire-public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { texteConsentement } from '@/lib/consentement/textes';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';
import { TitrePage } from '@/components/titre-page';
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
    <PagePublique style={stylesJetonsAccent(jetons) as CSSProperties} cabinet={seminaire.cabinet}>
      <EnTeteLogos cabinet={seminaire.cabinet} codePublic={codePublic} logoClientUrl={seminaire.logoClientUrl} />

      <CartePublique>
        <TitrePage surtitre="Vous vous inscrivez à" titre={seminaire.titre}>
          <p className="text-[color:var(--gris-700)]">
            {formaterDateLongue(seminaire.dateDebut)} · {formaterHeure(seminaire.dateDebut)}–{formaterHeure(seminaire.dateFin)}
            {seminaire.lieu ? ` · ${seminaire.lieu}` : ''}
          </p>
        </TitrePage>

        <FormulaireInscription
          action={inscrireAction.bind(null, codePublic)}
          jetonFormulaire={jetonFormulaire}
          texteInformation={`${texteInformation.texte} ${texteInformation.dureeConservation}`}
          texteCommunications={texteCommunications.texte}
          texteEmployeur={texteEmployeur.texte}
        />
      </CartePublique>
    </PagePublique>
  );
}
