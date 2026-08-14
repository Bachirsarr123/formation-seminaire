import type { VueResultats } from '@/lib/organisateur/resultats';
import { BarreDistribution } from './barre-distribution';
import { ListeReponsesOuvertes } from './liste-reponses-ouvertes';
import { DiagrammeRecapitulatif } from './diagramme-recapitulatif';

// Partie anonyme des résultats (comparaison, moyennes par module, questions
// fermées/ouvertes), partagée entre la page organisateur/formateur
// (organisateur/(protege)/seminaires/[id]/resultats/page.tsx) et
// /f/{codeFormateur} — même seuil d'anonymat, même rendu, deux points d'accès.
// N'inclut délibérément PAS les non-répondants ni les exports CSV : ce sont
// des extras propres à l'espace organisateur, pas au lien formateur.
export function ResultatsSeminaire({ vue }: { vue: VueResultats }) {
  return (
    <div className="flex flex-col gap-6">
      {!vue.visible ? (
        <p className="text-[color:var(--gris-700)]">Aucune réponse pour l&apos;instant.</p>
      ) : (
        <>
          {vue.comparaison ? (
            <section className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
              <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Comparaison</h2>
              <p className="text-[color:var(--gris-700)]">
                Moyenne de ce séminaire :{' '}
                <span className="chiffre font-semibold text-[color:var(--gris-900)]">{vue.comparaison.moyenneSeminaire.toFixed(2)}</span>{' '}
                — moyenne des <span className="chiffre">{vue.comparaison.nbSeminairesPrecedents}</span> séminaires
                précédents (même modèle) :{' '}
                <span className="chiffre font-semibold text-[color:var(--gris-900)]">{vue.comparaison.moyennePrecedents.toFixed(2)}</span>
              </p>
            </section>
          ) : null}

          {vue.resultats && vue.resultats.modules.length > 0 ? (
            <section>
              <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Moyenne par module</h2>
              <ul className="flex flex-col gap-1">
                {vue.resultats.modules.map((m) => (
                  <li key={m.moduleId} className="flex justify-between gap-2 text-[color:var(--gris-700)]">
                    <span>{m.titre}</span>
                    <span className="chiffre">{m.moyenne.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {vue.resultats && vue.resultats.questionsFermees.length > 0 ? (
            <section className="flex flex-col gap-5">
              <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Questions fermées</h2>
              {vue.resultats.questionsFermees.map((q) => (
                <article key={q.questionId} className="flex flex-col gap-2 rounded-[var(--rayon-md)] border border-[color:var(--gris-100)] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[color:var(--gris-900)]">{q.intitule}</p>
                    {q.moyenne !== null ? <p className="chiffre text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{q.moyenne.toFixed(2)}</p> : null}
                  </div>
                  <BarreDistribution distribution={q.distribution} />
                  <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                    <span className="chiffre">{q.nbReponses}</span> réponse{q.nbReponses > 1 ? 's' : ''}
                    {q.sansOpinion > 0 ? (
                      <>
                        {' '}
                        — <span className="chiffre">{q.sansOpinion}</span> sans opinion (exclu{q.sansOpinion > 1 ? 'es' : 'e'} de la moyenne)
                      </>
                    ) : null}
                  </p>
                </article>
              ))}
            </section>
          ) : null}

          {vue.resultats && vue.resultats.questionsOuvertes.length > 0 ? (
            <section className="flex flex-col gap-5">
              <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Questions ouvertes</h2>
              {vue.resultats.questionsOuvertes.map((q) => (
                <article key={q.questionId} className="flex flex-col gap-2">
                  <p className="text-[color:var(--gris-900)]">
                    {q.intitule} <span className="chiffre text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">({q.total})</span>
                  </p>
                  <ListeReponsesOuvertes reponses={q.reponses} />
                </article>
              ))}
            </section>
          ) : null}

          {vue.resultats ? <DiagrammeRecapitulatif questions={vue.resultats.questionsFermees} /> : null}
        </>
      )}
    </div>
  );
}
