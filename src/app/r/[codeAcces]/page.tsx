import type { CSSProperties } from 'react';
import { chargerRecueilPublic } from '@/lib/recueil/public';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';
import { TitrePage } from '@/components/titre-page';
import { envoyerReponseRecueilAction } from './actions';
import { FormulaireRecueil } from './formulaire-recueil';

interface Props {
  params: Promise<{ codeAcces: string }>;
}

export default async function PageRecueil({ params }: Props) {
  const { codeAcces } = await params;
  const recueil = await chargerRecueilPublic(codeAcces);

  if (!recueil) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">
          Ce formulaire n&apos;est plus disponible.
        </p>
      </main>
    );
  }

  const jetons = deriverJetonsAccent(recueil.cabinet.couleurPrimaire);
  const jetonFormulaire = genererJetonFormulaire();

  return (
    <PagePublique style={stylesJetonsAccent(jetons) as CSSProperties} cabinet={recueil.cabinet}>
      <EnTeteLogos
        cabinet={recueil.cabinet}
        codePublic={recueil.seminaire.codePublic}
        logoClientUrl={recueil.seminaire.logoClientUrl}
      />

      <CartePublique>
        <TitrePage surtitre={recueil.titre} titre={recueil.seminaire.titre}>
          <p className="whitespace-pre-wrap text-[color:var(--gris-700)]">{recueil.description}</p>
        </TitrePage>

        <FormulaireRecueil
          action={envoyerReponseRecueilAction.bind(null, codeAcces)}
          jetonFormulaire={jetonFormulaire}
          questions={recueil.questions}
        />
      </CartePublique>
    </PagePublique>
  );
}
