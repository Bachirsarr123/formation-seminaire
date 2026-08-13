import type { CSSProperties } from 'react';
import { chargerReponsesRecueil } from '@/lib/recueil/consultation';
import { libellesReponseRecueil } from '@/lib/recueil/options';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';
import { TitrePage } from '@/components/titre-page';

interface Props {
  params: Promise<{ codeConsultation: string }>;
}

// Voir la même note dans /s/[codePublic]/page.tsx : le formateur doit
// toujours voir les dernières réponses reçues, jamais une version figée.
export const dynamic = 'force-dynamic';

export default async function PageConsultationRecueil({ params }: Props) {
  const { codeConsultation } = await params;
  const recueil = await chargerReponsesRecueil(codeConsultation);

  if (!recueil) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Ce lien n&apos;est pas valide.</p>
      </main>
    );
  }

  const jetons = deriverJetonsAccent(recueil.cabinet.couleurPrimaire);

  return (
    <PagePublique style={stylesJetonsAccent(jetons) as CSSProperties} cabinet={recueil.cabinet}>
      <EnTeteLogos
        cabinet={recueil.cabinet}
        codePublic={recueil.seminaire.codePublic}
        logoClientUrl={recueil.seminaire.logoClientUrl}
      />

      <CartePublique>
        <TitrePage surtitre="Séminaire de formation" titre={recueil.seminaire.titre}>
          <span className="chiffre w-fit rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)] px-3 py-1 text-[length:var(--taille-xs)] font-semibold text-[color:var(--couleur-accent-contraste)]">
            {recueil.reponses.length} réponse{recueil.reponses.length > 1 ? 's' : ''} reçue{recueil.reponses.length > 1 ? 's' : ''}
          </span>
        </TitrePage>

        {recueil.reponses.length === 0 ? (
          <p className="text-[color:var(--gris-700)]">Aucune réponse pour l&apos;instant.</p>
        ) : (
          <section className="flex flex-col gap-6">
            <h2 className="text-[length:var(--taille-sm)] uppercase tracking-wide text-[color:var(--gris-700)]">Réponses</h2>
            {recueil.reponses.map((reponse, index) => {
              const brut = (reponse.reponses ?? {}) as Record<string, string | string[]>;

              return (
                <article key={reponse.id} className="flex flex-col gap-3">
                  <div>
                    {/* Volontairement sans identité (ni nom, ni fonction, ni
                        organisation) : le formateur voit ce que les gens
                        attendent, jamais qui l'a dit — voir
                        lib/recueil/consultation.ts, qui exclut déjà ces
                        colonnes de la requête elle-même. */}
                    <p className="text-[length:var(--taille-md)] font-semibold text-[color:var(--gris-900)]">
                      Réponse {index + 1}
                    </p>
                  </div>

                  <ol className="flex flex-col gap-3">
                    {recueil.questions.map((question, qIndex) => {
                      const libelles = libellesReponseRecueil(question, brut[question.id]);
                      if (libelles.length === 0) return null;

                      return (
                        <li key={question.id}>
                          <p className="text-[color:var(--gris-800)]">
                            {qIndex + 1}. {question.intitule}
                          </p>
                          {question.type === 'CHOIX_MULTIPLE' ? (
                            <ul className="ml-4 list-disc text-[color:var(--gris-700)]">
                              {libelles.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          ) : question.type === 'TEXTE_LIBRE' ? (
                            <p className="whitespace-pre-wrap text-[color:var(--gris-700)]">« {libelles[0]} »</p>
                          ) : (
                            <p className="text-[color:var(--gris-700)]">{libelles[0]}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  {index < recueil.reponses.length - 1 ? <hr className="border-[color:var(--gris-100)]" /> : null}
                </article>
              );
            })}
          </section>
        )}
      </CartePublique>
    </PagePublique>
  );
}
