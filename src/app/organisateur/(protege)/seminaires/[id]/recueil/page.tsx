import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirRecueil } from '@/lib/organisateur/recueil';
import { construireOrigineRequete } from '@/lib/origine-requete';
import { LIBELLE_TYPE_RECUEIL_QUESTION } from '@/lib/libelles';
import { libellesReponseRecueil } from '@/lib/recueil/options';
import { creerRecueilAction } from './actions';
import { FormulaireCreerRecueil } from './formulaire-creer-recueil';
import { BoutonCopier } from '../bouton-copier';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';

// Réservée aux organisateurs (même discipline que choisir-modele) : le
// formateur, sans compte de son côté sur ce lot, accède aux réponses par le
// lien de consultation, jamais par cet écran.
export default async function PageRecueil({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const recueil = await obtenirRecueil(contexte.cabinetId, id);

  if (!recueil) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          Recueil de besoins — {seminaire.titre}
        </h1>
        <p className="text-[color:var(--gris-700)]">
          Les participants sont déjà inscrits par leur employeur — pas d&apos;inscription à faire ici. Ce formulaire
          nominatif sert à recueillir leurs besoins avant la formation, pour le formateur. Il est indépendant du
          questionnaire d&apos;évaluation.
        </p>
        <FormulaireCreerRecueil action={creerRecueilAction.bind(null, id)} />
      </div>
    );
  }

  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lienAcces = `${origine}/r/${recueil.codeAcces}`;
  const lienConsultation = `${origine}/rc/${recueil.codeConsultation}`;
  const lienExport = `${origine}/organisateur/seminaires/${id}/recueil/export.xlsx`;
  const nbReponses = recueil.reponses.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{recueil.titre}</h1>
        <p className="text-[color:var(--gris-600)]">{seminaire.titre}</p>
      </div>

      <p className="text-[color:var(--gris-700)]">{recueil.description}</p>

      <section className="flex flex-col gap-4 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <div className="flex flex-col gap-2">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Lien à diffuser aux participants</p>
          <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienAcces}</p>
          <BoutonCopier valeur={lienAcces} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            Lien de consultation à envoyer au formateur — affiche les réponses sans identité (ni nom, ni fonction, ni
            organisation). Cet écran-ci reste le seul endroit où l&apos;on voit qui a répondu quoi.
          </p>
          <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienConsultation}</p>
          <BoutonCopier valeur={lienConsultation} libelle="Copier le lien de consultation" />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="chiffre text-[color:var(--gris-700)]">
          {nbReponses} réponse{nbReponses > 1 ? 's' : ''} reçue{nbReponses > 1 ? 's' : ''}
        </p>
        {nbReponses > 0 ? (
          <a href={lienExport} className={CLASSE_BOUTON_TEXTE}>
            Télécharger en Excel
          </a>
        ) : null}
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Questions ({recueil.questions.length})</h2>
          <a href={`/organisateur/seminaires/${id}/recueil/modifier`} className={CLASSE_BOUTON_TEXTE}>
            Modifier les questions
          </a>
        </div>
        {recueil.questions.length === 0 ? (
          <p className="text-[color:var(--gris-700)]">Aucune question pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recueil.questions.map((question) => (
              <li key={question.id} className="text-[color:var(--gris-700)]">
                {question.intitule} <span className="text-[color:var(--gris-500)]">— {LIBELLE_TYPE_RECUEIL_QUESTION[question.type]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recueil.reponses.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Réponses</h2>
          {/* Seul endroit de l'application qui affiche à la fois l'identité
              et les réponses (voir lib/organisateur/recueil.ts) — la
              consultation formateur (/rc) n'expose jamais nom/fonction/
              organisation. */}
          <div className="flex flex-col gap-6">
            {recueil.reponses.map((reponse, index) => {
              const brut = (reponse.reponses ?? {}) as Record<string, string | string[]>;
              const identite = [reponse.fonction, reponse.organisation].filter(Boolean).join(', ');

              return (
                <article key={reponse.id} className="flex flex-col gap-3">
                  <p className="text-[length:var(--taille-md)] font-semibold text-[color:var(--gris-900)]">
                    {reponse.prenom} {reponse.nom}
                    {identite ? <span className="font-normal text-[color:var(--gris-600)]"> — {identite}</span> : null}
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
        </section>
      ) : null}
    </div>
  );
}
