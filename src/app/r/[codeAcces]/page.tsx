import type { CSSProperties } from 'react';
import { chargerRecueilPublic } from '@/lib/recueil/public';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { PiedDePageCabinet } from '@/components/pied-de-page-cabinet';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
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
    <main
      style={stylesJetonsAccent(jetons) as CSSProperties}
      className="mx-auto flex min-h-screen max-w-lg flex-col gap-[var(--espace-8)] bg-[color:var(--gris-050)] p-4 pb-12"
    >
      <EnTeteLogos
        cabinet={recueil.cabinet}
        codePublic={recueil.seminaire.codePublic}
        logoClientUrl={recueil.seminaire.logoClientUrl}
      />

      <CartePublique>
        <header className="flex flex-col gap-2">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">Séminaire de formation :</p>
          <h1 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{recueil.seminaire.titre}</h1>
          <p className="text-[length:var(--taille-md)] font-semibold uppercase text-[color:var(--gris-800)]">{recueil.titre}</p>
          <p className="whitespace-pre-wrap text-[color:var(--gris-700)]">{recueil.description}</p>
        </header>

        <FormulaireRecueil
          action={envoyerReponseRecueilAction.bind(null, codeAcces)}
          jetonFormulaire={jetonFormulaire}
          questions={recueil.questions}
        />
      </CartePublique>

      <PiedDePageCabinet cabinet={recueil.cabinet} />
    </main>
  );
}
