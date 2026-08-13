import type { CSSProperties } from 'react';
import { resoudreContexteLienFormateur } from '@/lib/formateur-lien';
import { listerInscriptionsSeminaire } from '@/lib/organisateur/participants';
import { obtenirResultatsSeminaire } from '@/lib/organisateur/resultats';
import { chargerReponsesRecueilParSeminaire } from '@/lib/recueil/consultation';
import { libellesReponseRecueil } from '@/lib/recueil/options';
import { LIBELLE_MODALITE } from '@/lib/libelles';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { ResultatsSeminaire } from '@/components/resultats-seminaire';
import { EnTeteLogos } from '@/components/en-tete-logos';
import { CartePublique } from '@/components/carte-publique';
import { PagePublique } from '@/components/page-publique';
import { TitrePage } from '@/components/titre-page';

interface Props {
  params: Promise<{ codeFormateur: string }>;
}

// Voir la même note dans /s/[codePublic]/page.tsx : participants, résultats,
// recueil, CV fraîchement téléversé — jamais une version mise en cache.
export const dynamic = 'force-dynamic';

// Aucune session, aucun cookie : le code de l'URL EST l'accès (même principe
// que /rc/{codeConsultation}) — jamais de distinction 403/404, un code
// inconnu ou périmé (compte désactivé, séminaire supprimé) rend exactement
// la même page.
export default async function PageLienFormateur({ params }: Props) {
  const { codeFormateur } = await params;
  const contexte = await resoudreContexteLienFormateur(codeFormateur);

  if (!contexte) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Ce lien n&apos;est pas valide.</p>
      </main>
    );
  }

  const { seminaire } = contexte;
  // Contexte synthétique — les fonctions lib/organisateur/{notations,resultats}.ts
  // acceptent un ContexteOrganisateur de forme identique, qu'il vienne d'une
  // session (espace organisateur) ou, comme ici, d'un code résolu : même
  // vérification d'affectation (SeminaireFormateur), sans dupliquer la
  // logique d'accès.
  const contexteFormateur = { utilisateurId: contexte.utilisateurId, cabinetId: contexte.cabinetId, role: 'FORMATEUR' as const };

  const [inscriptions, resultats, recueil] = await Promise.all([
    listerInscriptionsSeminaire(contexte.cabinetId, seminaire.id, 'CONFIRMEE'),
    obtenirResultatsSeminaire(contexte.cabinetId, seminaire.id, contexteFormateur),
    chargerReponsesRecueilParSeminaire(seminaire.id),
  ]);

  const jetons = deriverJetonsAccent(contexte.cabinet.couleurPrimaire);

  return (
    <PagePublique style={stylesJetonsAccent(jetons) as CSSProperties} cabinet={contexte.cabinet}>
      <EnTeteLogos cabinet={contexte.cabinet} codePublic={seminaire.codePublic} logoClientUrl={seminaire.logoClientUrl} />

      <CartePublique>
        <TitrePage surtitre={`Bonjour ${contexte.formateur.prenom} ${contexte.formateur.nom}`} titre={seminaire.titre}>
          <p className="text-[color:var(--gris-700)]">
            {formaterDateLongue(seminaire.dateDebut)} · {formaterHeure(seminaire.dateDebut)}–{formaterHeure(seminaire.dateFin)}
            {seminaire.lieu ? ` · ${seminaire.lieu}` : ''} · {LIBELLE_MODALITE[seminaire.modalite]}
          </p>
          {contexte.formateur.cvUrl ? (
            <a href={`/f/${codeFormateur}/cv`} target="_blank" rel="noreferrer" className="text-[length:var(--taille-sm)] underline">
              Voir mon CV
            </a>
          ) : null}
        </TitrePage>

        <a
          href={`/f/${codeFormateur}/notations`}
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--couleur-accent)] px-4 text-[color:var(--couleur-accent-contraste)]"
        >
          Noter les participants
        </a>

        <section aria-label="Participants">
          <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
            Participants {inscriptions ? <span className="chiffre">({inscriptions.length})</span> : null}
          </h2>
          {!inscriptions || inscriptions.length === 0 ? (
            <p className="text-[color:var(--gris-700)]">Aucun participant confirmé pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {inscriptions.map((i) => (
                <li key={i.id} className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
                  <p className="text-[color:var(--gris-900)]">
                    {i.participant.prenom} {i.participant.nom}
                  </p>
                  {i.participant.fonction || i.participant.organisation ? (
                    <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
                      {[i.participant.fonction, i.participant.organisation].filter(Boolean).join(' — ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {recueil ? (
          <section aria-label="Recueil de besoins">
            <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
              Recueil de besoins{' '}
              <span className="chiffre text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
                ({recueil.reponses.length} réponse{recueil.reponses.length > 1 ? 's' : ''})
              </span>
            </h2>
            {recueil.reponses.length === 0 ? (
              <p className="text-[color:var(--gris-700)]">Aucune réponse pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {recueil.reponses.map((reponse, index) => {
                  const brut = (reponse.reponses ?? {}) as Record<string, string | string[]>;

                  return (
                    <article key={reponse.id} className="flex flex-col gap-3">
                      {/* Volontairement sans identité (ni nom, ni fonction, ni
                          organisation) : voir lib/recueil/consultation.ts, qui
                          exclut déjà ces colonnes de la requête elle-même —
                          même règle que /rc/{codeConsultation}. */}
                      <p className="text-[length:var(--taille-md)] font-semibold text-[color:var(--gris-900)]">
                        Réponse {index + 1}
                      </p>
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
              </div>
            )}
          </section>
        ) : null}

        {resultats ? (
          <section aria-label="Résultats d'évaluation">
            <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Résultats d&apos;évaluation</h2>
            <ResultatsSeminaire vue={resultats} />
          </section>
        ) : null}
      </CartePublique>
    </PagePublique>
  );
}
