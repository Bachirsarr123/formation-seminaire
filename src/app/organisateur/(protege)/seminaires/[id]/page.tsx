import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur, type ContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirQuestionnaireActifDuSeminaire } from '@/lib/organisateur/questionnaires';
import { obtenirRecueil } from '@/lib/organisateur/recueil';
import { obtenirResultatsSeminaire } from '@/lib/organisateur/resultats';
import { obtenirOuCreerLienEvaluation } from '@/lib/organisateur/lien-evaluation';
import { LIBELLE_MODALITE, LIBELLE_STATUT_QUESTIONNAIRE, LIBELLE_STATUT_SEMINAIRE } from '@/lib/libelles';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import {
  construireLienFormateur,
  construireLienPublicSeminaire,
  genererApercuQrSvg,
  genererTexteInvitation,
} from '@/lib/organisateur/diffusion';
import { construireOrigineRequete } from '@/lib/origine-requete';
import { dupliquerSeminaireAction, regenererCodeFormateurAction } from './actions';
import { BoutonCopier } from './bouton-copier';
import { BoutonSupprimer } from './bouton-supprimer';
import { SelecteurStatut } from './selecteur-statut';

interface Props {
  params: Promise<{ id: string }>;
}

// Une ressource d'un autre cabinet est traitée EXACTEMENT comme une ressource
// inexistante (règle B) : notFound() dans les deux cas, jamais un 403 qui
// confirmerait son existence ailleurs.
export default async function PageFicheSeminaire({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();
  const estFormateur = contexte.role === 'FORMATEUR';

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const dupliquer = dupliquerSeminaireAction.bind(null, seminaire.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* min-w-0 + break-words : un titre long est un enfant flex, qui par
            défaut refuse de rétrécir sous sa largeur en une seule ligne
            (min-width:auto) plutôt que de passer à la ligne — débordement
            horizontal trouvé à 320px/zoom 200% (étape 8). */}
        <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          {seminaire.titre}
        </h1>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/organisateur/seminaires/${seminaire.id}/participants`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
          >
            Participants
          </a>
          <a
            href={`/organisateur/seminaires/${seminaire.id}/resultats`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
          >
            Résultats
          </a>
          <a
            href={`/organisateur/seminaires/${seminaire.id}/notations`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
          >
            Notations
          </a>
          {!estFormateur ? (
            <>
              <a
                href={`/organisateur/seminaires/${seminaire.id}/supports`}
                className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
              >
                Supports
              </a>
              <a
                href={`/organisateur/seminaires/${seminaire.id}/messages`}
                className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
              >
                Messages
              </a>
              <a
                href={`/organisateur/seminaires/${seminaire.id}/modifier`}
                className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
              >
                Modifier
              </a>
              <form action={dupliquer}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
                >
                  Dupliquer
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {seminaire.description ? <p className="text-[color:var(--gris-700)]">{seminaire.description}</p> : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Dates</dt>
          <dd className="text-[color:var(--gris-900)]">
            {formaterDateLongue(seminaire.dateDebut)} · {formaterHeure(seminaire.dateDebut)}–{formaterHeure(seminaire.dateFin)}
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Lieu</dt>
          <dd className="text-[color:var(--gris-900)]">{seminaire.lieu ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Modalité</dt>
          <dd className="text-[color:var(--gris-900)]">{LIBELLE_MODALITE[seminaire.modalite]}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Durée</dt>
          <dd className="chiffre text-[color:var(--gris-900)]">{seminaire.dureeHeures} h</dd>
        </div>
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Capacité</dt>
          <dd className="chiffre text-[color:var(--gris-900)]">{seminaire.capaciteMax ?? 'Illimitée'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Code public</dt>
          <dd className="chiffre text-[color:var(--gris-900)]">{seminaire.codePublic}</dd>
        </div>
      </dl>

      {!estFormateur ? (
        <SelecteurStatut seminaireId={seminaire.id} statutActuel={seminaire.statut} />
      ) : (
        <p className="text-[color:var(--gris-700)]">Statut : {LIBELLE_STATUT_SEMINAIRE[seminaire.statut]}</p>
      )}

      {seminaire.modules.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Programme</h2>
          <ol className="flex flex-col gap-1">
            {seminaire.modules.map((m, i) => (
              <li key={m.id} className="flex justify-between gap-2 text-[color:var(--gris-700)]">
                <span>
                  {i + 1}. {m.titre}
                </span>
                <span className="chiffre text-[color:var(--gris-500)]">{m.dureeMinutes} min</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {seminaire.formateurs.length > 0 && !estFormateur ? (
        <SectionFormateurs seminaireId={seminaire.id} formateurs={seminaire.formateurs} />
      ) : seminaire.formateurs.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Formateurs</h2>
          <ul className="flex flex-col gap-1">
            {seminaire.formateurs.map((f) => (
              <li key={f.utilisateurId} className="text-[color:var(--gris-700)]">
                {f.utilisateur.prenom} {f.utilisateur.nom}
                {f.roleFormateur === 'PRINCIPAL' ? ' (principal)' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!estFormateur ? <SectionQuestionnaire seminaireId={seminaire.id} cabinetId={contexte.cabinetId} /> : null}

      {/* Évaluation à chaud : n'a de sens qu'une fois la formation démarrée
          (EN_COURS) ou terminée (CLOTURE/ARCHIVE) — jamais avant, il n'y a
          encore personne à relancer. */}
      {!estFormateur && seminaire.statut !== 'BROUILLON' && seminaire.statut !== 'PUBLIE' ? (
        <SectionEvaluationChaud seminaireId={seminaire.id} contexte={contexte} />
      ) : null}

      {!estFormateur ? <SectionRecueil seminaireId={seminaire.id} cabinetId={contexte.cabinetId} /> : null}

      {/* "dès que le statut est PUBLIE" : les transitions ne reviennent
          jamais en arrière au-delà de EN_COURS (changerStatutSeminaire), donc
          une fois publié le séminaire reste diffusable pour le reste de son
          cycle (EN_COURS, CLOTURE, ARCHIVE) — pas seulement le temps où le
          statut vaut littéralement PUBLIE. */}
      {seminaire.statut !== 'BROUILLON' ? <SectionDiffusion seminaire={seminaire} /> : null}

      {!estFormateur ? <BoutonSupprimer seminaireId={seminaire.id} /> : null}
    </div>
  );
}

// Un séminaire n'a pas de questionnaire tant que l'organisateur n'en a pas
// choisi un depuis la bibliothèque (choisir-modele) — lien direct vers
// l'éditeur une fois qu'il en existe un, y compris une éventuelle nouvelle
// copie créée après verrouillage (obtenirQuestionnaireActifDuSeminaire
// retourne toujours le plus récent).
async function SectionQuestionnaire({ seminaireId, cabinetId }: { seminaireId: string; cabinetId: string }) {
  const questionnaire = await obtenirQuestionnaireActifDuSeminaire(cabinetId, seminaireId);

  return (
    <section>
      <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Questionnaire d&apos;évaluation</h2>
      {questionnaire ? (
        <a
          href={`/organisateur/questionnaires/${questionnaire.id}`}
          className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          {LIBELLE_STATUT_QUESTIONNAIRE[questionnaire.statut]} — {questionnaire.titre}
        </a>
      ) : (
        <a
          href={`/organisateur/seminaires/${seminaireId}/questionnaire/choisir-modele`}
          className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Créer le questionnaire d&apos;évaluation
        </a>
      )}
    </section>
  );
}

// Même principe que le recueil de besoins (SectionRecueil/le lien
// r/{codeAcces} ci-dessous) : un seul lien à copier et diffuser à tous les
// participants d'un coup — plus besoin de suivre qui a répondu ni de
// relancer individuellement. Le lien est public (aucune identité requise
// pour répondre, cohérent avec la Règle 2 : une Soumission n'a de toute
// façon jamais porté de lien vers un participant), voir
// lib/questionnaire/public.ts et /e/[codeAcces].
async function SectionEvaluationChaud({ seminaireId, contexte }: { seminaireId: string; contexte: ContexteOrganisateur }) {
  const vue = await obtenirResultatsSeminaire(contexte.cabinetId, seminaireId, contexte);
  // null : accès refusé (ne devrait pas arriver ici, le reste de la page a
  // déjà vérifié l'accès) ; questionnaireId null : pas encore de
  // questionnaire créé, rien à diffuser tant que SectionQuestionnaire
  // ci-dessus n'en a pas un à proposer.
  if (!vue || vue.questionnaireId === null) return null;

  const codeAcces = await obtenirOuCreerLienEvaluation(contexte.cabinetId, seminaireId);
  if (!codeAcces) return null;

  const origine = construireOrigineRequete(await headers());
  const lienEvaluation = `${origine}/e/${codeAcces}`;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Évaluation à chaud</h2>

      <p className="chiffre text-[color:var(--gris-700)]">
        {vue.totalSoumissions} réponse{vue.totalSoumissions > 1 ? 's' : ''} reçue{vue.totalSoumissions > 1 ? 's' : ''}
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Lien à diffuser aux participants</p>
        <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienEvaluation}</p>
        <BoutonCopier valeur={lienEvaluation} />
      </div>

      <a
        href={`/organisateur/seminaires/${seminaireId}/resultats`}
        className="w-fit text-[length:var(--taille-sm)] text-[color:var(--gris-700)] underline"
      >
        Voir les résultats
      </a>
    </section>
  );
}

// Indépendant de SectionQuestionnaire ci-dessus (lot recueil, table à part) :
// un séminaire peut avoir un recueil, un questionnaire d'évaluation, les
// deux, ou aucun — jamais de lien entre eux.
async function SectionRecueil({ seminaireId, cabinetId }: { seminaireId: string; cabinetId: string }) {
  const recueil = await obtenirRecueil(cabinetId, seminaireId);

  return (
    <section>
      <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Recueil de besoins</h2>
      <a
        href={`/organisateur/seminaires/${seminaireId}/recueil`}
        className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
      >
        {recueil ? recueil.titre : 'Créer le recueil de besoins'}
      </a>
    </section>
  );
}

interface FormateurAvecCode {
  utilisateurId: string;
  roleFormateur: 'PRINCIPAL' | 'INTERVENANT';
  codeFormateur: string;
  utilisateur: { prenom: string; nom: string };
}

// Le formateur ne se connecte jamais : /f/{codeFormateur} est son SEUL accès
// (fiche séminaire, participants, recueil, résultats, notation) — un lien par
// paire (séminaire, formateur), régénérable ici (l'ancien cesse aussitôt de
// fonctionner). Réservé à l'organisateur (!estFormateur à l'appel) : ce
// n'est pas un lien à diffuser largement comme le lien public du séminaire.
async function SectionFormateurs({ seminaireId, formateurs }: { seminaireId: string; formateurs: FormateurAvecCode[] }) {
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Formateurs</h2>
      <ul className="flex flex-col gap-3">
        {formateurs.map((f) => {
          const lien = construireLienFormateur(origine, f.codeFormateur);
          const regenerer = regenererCodeFormateurAction.bind(null, seminaireId, f.utilisateurId);

          return (
            <li key={f.utilisateurId} className="flex flex-col gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3">
              <p className="text-[color:var(--gris-800)]">
                {f.utilisateur.prenom} {f.utilisateur.nom}
                {f.roleFormateur === 'PRINCIPAL' ? ' (principal)' : ''}
              </p>
              <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">{lien}</p>
              <div className="flex flex-wrap gap-3">
                <BoutonCopier valeur={lien} />
                <form action={regenerer}>
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
                  >
                    Régénérer le lien
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface SeminairePourDiffusion {
  id: string;
  titre: string;
  codePublic: string;
  dateDebut: Date;
  lieu: string | null;
  modalite: 'PRESENTIEL' | 'DISTANCIEL' | 'HYBRIDE';
}

async function SectionDiffusion({ seminaire }: { seminaire: SeminairePourDiffusion }) {
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lien = construireLienPublicSeminaire(origine, seminaire.codePublic);
  const texteInvitation = genererTexteInvitation(seminaire, lien);
  const qrApercu = await genererApercuQrSvg(lien);

  return (
    <section className="flex flex-col gap-4 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Diffusion</h2>

      <div className="flex flex-col gap-2">
        <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lien}</p>
        <BoutonCopier valeur={lien} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Voir confirmation/page.tsx (parcours participant) : le SVG généré
            par la lib QRCode porte une largeur fixe codée dans son markup,
            qui déborde en flex sans cette contrainte. */}
        {/* eslint-disable-next-line react/no-danger */}
        <div className="[&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: qrApercu }} aria-hidden="true" />
        {/* flex-wrap ici aussi : sans lui, ces deux liens ("Télécharger en
            PNG"/"SVG") débordent horizontalement à 320px/zoom 200% — trouvé
            en reproduisant l'échec responsive-320-zoom.spec.ts (étape 9). */}
        <div className="flex flex-wrap gap-3">
          <a
            href={`/organisateur/seminaires/${seminaire.id}/qr.png`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
          >
            Télécharger en PNG
          </a>
          <a
            href={`/organisateur/seminaires/${seminaire.id}/qr.svg`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
          >
            Télécharger en SVG
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Texte d&apos;invitation</p>
        <pre className="whitespace-pre-wrap break-words rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] p-3 font-sans text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">
          {texteInvitation}
        </pre>
        <BoutonCopier valeur={texteInvitation} libelle="Copier le texte d'invitation" />
      </div>
    </section>
  );
}
