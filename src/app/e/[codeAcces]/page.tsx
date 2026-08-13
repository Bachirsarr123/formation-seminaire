import type { CSSProperties } from 'react';
import { chargerEvaluationPublique } from '@/lib/questionnaire/public';
import { genererJetonFormulaire } from '@/lib/anti-spam';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { nomChampQuestion } from '@/lib/questionnaire/validation-reponses';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';
import { TitrePage } from '@/components/titre-page';
import { FormulaireEvaluationPublique } from './formulaire-evaluation-publique';

interface Props {
  params: Promise<{ codeAcces: string }>;
}

// Voir la même note dans /r/[codeAcces]/page.tsx et /s/[codePublic]/page.tsx :
// questionnaire actif, logos, ne doit jamais servir une version mise en cache.
export const dynamic = 'force-dynamic';

export default async function PageEvaluationPublique({ params }: Props) {
  const { codeAcces } = await params;
  const evaluation = await chargerEvaluationPublique(codeAcces);

  if (!evaluation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">
          Ce formulaire n&apos;est plus disponible.
        </p>
      </main>
    );
  }

  const jetons = deriverJetonsAccent(evaluation.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  return (
    <PagePublique style={style} cabinet={evaluation.cabinet}>
      <EnTeteLogos
        cabinet={evaluation.cabinet}
        codePublic={evaluation.seminaire.codePublic}
        logoClientUrl={evaluation.seminaire.logoClientUrl}
      />

      <CartePublique>
        <TitrePage surtitre="Évaluation à chaud" titre={evaluation.seminaire.titre}>
          <p className="text-[color:var(--gris-700)]">
            Vos réponses sont anonymes. Nous savons que quelqu&apos;un a répondu, jamais qui a répondu quoi.
          </p>
        </TitrePage>

        {evaluation.questionnaire ? (
          <FormulaireEvaluationPublique
            codeAcces={codeAcces}
            questionnaireId={evaluation.questionnaire.id}
            sections={evaluation.questionnaire.sections}
            champs={evaluation.questionnaire.sections.flatMap((s) => s.questions.map((q) => nomChampQuestion(q.id)))}
            jetonFormulaire={genererJetonFormulaire()}
          />
        ) : (
          <p className="text-[color:var(--gris-700)]">{evaluation.messageIndisponible}</p>
        )}
      </CartePublique>
    </PagePublique>
  );
}
