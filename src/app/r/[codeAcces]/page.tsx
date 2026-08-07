import type { CSSProperties } from 'react';
import { chargerRecueilPublic } from '@/lib/recueil/public';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { PiedDePageCabinet } from '@/components/pied-de-page-cabinet';
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

  const jetons = deriverJetonsAccent(null);
  const jetonFormulaire = genererJetonFormulaire();

  return (
    <main style={stylesJetonsAccent(jetons) as CSSProperties} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <header className="flex flex-col gap-2">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Séminaire de formation :</p>
        <h1 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{recueil.seminaire.titre}</h1>
        <p className="text-[length:var(--taille-md)] font-semibold uppercase text-[color:var(--gris-800)]">{recueil.titre}</p>
        <p className="whitespace-pre-wrap text-[color:var(--gris-700)]">{recueil.description}</p>
      </header>

      <FormulaireRecueil
        action={envoyerReponseRecueilAction.bind(null, codeAcces)}
        jetonFormulaire={jetonFormulaire}
        questions={recueil.questions}
      />

      <PiedDePageCabinet cabinet={recueil.cabinet} />
    </main>
  );
}
