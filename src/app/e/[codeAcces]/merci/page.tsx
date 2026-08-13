import type { CSSProperties } from 'react';
import { chargerEvaluationPublique } from '@/lib/questionnaire/public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';

interface Props {
  params: Promise<{ codeAcces: string }>;
}

// Voir la même note dans /r/[codeAcces]/merci/page.tsx.
export const dynamic = 'force-dynamic';

export default async function PageEvaluationPubliqueMerci({ params }: Props) {
  const { codeAcces } = await params;
  const evaluation = await chargerEvaluationPublique(codeAcces);
  const jetons = deriverJetonsAccent(evaluation?.cabinet.couleurPrimaire);

  return (
    <PagePublique style={stylesJetonsAccent(jetons) as CSSProperties} cabinet={evaluation?.cabinet}>
      {evaluation ? (
        <EnTeteLogos
          cabinet={evaluation.cabinet}
          codePublic={evaluation.seminaire.codePublic}
          logoClientUrl={evaluation.seminaire.logoClientUrl}
        />
      ) : null}
      <CartePublique className="flex-1 items-center justify-center text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Merci, votre réponse a bien été envoyée.</p>
        <p className="text-[color:var(--gris-700)]">Vous pouvez fermer cette page.</p>
      </CartePublique>
    </PagePublique>
  );
}
