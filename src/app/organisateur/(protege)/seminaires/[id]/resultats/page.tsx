import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirResultatsSeminaire } from '@/lib/organisateur/resultats';
import { BarreDistribution } from './barre-distribution';
import { ListeReponsesOuvertes } from './liste-reponses-ouvertes';
import { relancerNonRepondantAction } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';

// Accessible aux deux rôles, mais un formateur n'atteint que ses propres
// séminaires (vérifié dans obtenirResultatsSeminaire, pas ici) — une
// ressource hors périmètre est traitée exactement comme une ressource
// inexistante (règle B), jamais un 403.
export default async function PageResultats({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const vue = await obtenirResultatsSeminaire(contexte.cabinetId, id, contexte);
  if (!vue) notFound();

  const tauxReponse = vue.inscrits > 0 ? Math.round((vue.repondants / vue.inscrits) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Résultats — {vue.seminaireTitre}</h1>
        <p className="text-[color:var(--gris-700)]">
          <span className="chiffre">{vue.repondants}</span> répondant{vue.repondants > 1 ? 's' : ''} sur{' '}
          <span className="chiffre">{vue.inscrits}</span> inscrit{vue.inscrits > 1 ? 's' : ''}
          {tauxReponse !== null ? <span className="chiffre"> ({tauxReponse}%)</span> : null}
        </p>
      </div>

      {!vue.visible ? (
        <div className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
          <p className="text-[color:var(--gris-800)]">
            <span className="chiffre">{vue.totalSoumissions}</span> réponse{vue.totalSoumissions > 1 ? 's' : ''} reçue
            {vue.totalSoumissions > 1 ? 's' : ''} sur un seuil de <span className="chiffre">{vue.seuilAnonymat}</span>.
          </p>
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            Les résultats ne s&apos;affichent qu&apos;à partir de {vue.seuilAnonymat} réponses, pour qu&apos;aucune
            réponse individuelle ne reste identifiable dans un petit groupe.
          </p>
        </div>
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

          <section className="flex flex-wrap gap-3">
            <a href={`/organisateur/seminaires/${id}/resultats/export-agrege.csv`} className={CLASSE_BOUTON_TEXTE}>
              Exporter les résultats (CSV)
            </a>
            <a href={`/organisateur/seminaires/${id}/resultats/export-brut.csv`} className={CLASSE_BOUTON_TEXTE}>
              Exporter les réponses brutes anonymisées (CSV)
            </a>
          </section>
        </>
      )}

      {vue.nonRepondants.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
            Non-répondants (<span className="chiffre">{vue.nonRepondants.length}</span>)
          </h2>
          <ul className="flex flex-col gap-2">
            {vue.nonRepondants.map((p) => (
              <li key={p.participantId} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
                <span className="text-[color:var(--gris-800)]">
                  {p.prenom} {p.nom}
                </span>
                {contexte.role === 'ORGANISATEUR' ? (
                  <form action={relancerNonRepondantAction.bind(null, id, p.participantId)}>
                    <button type="submit" className={CLASSE_BOUTON_TEXTE}>
                      Relancer
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
