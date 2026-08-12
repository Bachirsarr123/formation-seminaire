import type { CSSProperties } from 'react';
import { chargerRecueilPublic } from '@/lib/recueil/public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { PiedDePageCabinet } from '@/components/pied-de-page-cabinet';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';

interface Props {
  params: Promise<{ codeAcces: string }>;
}

export default async function PageRecueilMerci({ params }: Props) {
  const { codeAcces } = await params;
  const recueil = await chargerRecueilPublic(codeAcces);
  const jetons = deriverJetonsAccent(recueil?.cabinet.couleurPrimaire);

  return (
    <main
      style={stylesJetonsAccent(jetons) as CSSProperties}
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-between gap-[var(--espace-8)] bg-[color:var(--gris-050)] p-4 pb-12"
    >
      <div className="flex flex-1 flex-col gap-[var(--espace-8)]">
        {recueil ? (
          <EnTeteLogos
            cabinet={recueil.cabinet}
            codePublic={recueil.seminaire.codePublic}
            logoClientUrl={recueil.seminaire.logoClientUrl}
          />
        ) : null}
        <CartePublique className="flex-1 items-center justify-center text-center">
          <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Merci, votre réponse a bien été envoyée.</p>
          <p className="text-[color:var(--gris-700)]">Vous pouvez fermer cette page.</p>
        </CartePublique>
      </div>
      {recueil ? <PiedDePageCabinet cabinet={recueil.cabinet} /> : null}
    </main>
  );
}
