import type { CSSProperties } from 'react';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { estConsentementActif } from '@/lib/consentement';
import { calculerPhaseSeminaire } from '@/lib/phase-seminaire';
import { listerSupportsVisibles } from '@/lib/supports-participant';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import { AccesIntrouvable } from '@/components/acces-introuvable';
import { BoutonAnnuler } from './bouton-annuler';
import { BoutonReinscrire } from './bouton-reinscrire';
import { ToggleConsentement } from './toggle-consentement';
import {
  autoriserCommunicationsAction,
  autoriserPartageEmployeurAction,
  retirerCommunicationsAction,
  retirerPartageEmployeurAction,
} from './actions';

export default async function PageMonEspace() {
  const jeton = await lireJetonSession();
  if (!jeton) {
    return <AccesIntrouvable />;
  }

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return <AccesIntrouvable />;
  }

  const jetons = deriverJetonsAccent(contexte.seminaire.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  if (contexte.inscription.statut === 'ANNULEE') {
    return (
      <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{contexte.seminaire.titre}</h1>
        <p className="text-[color:var(--gris-700)]">Votre inscription est annulée.</p>
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Vous pouvez vous réinscrire à tout moment, en un clic.
        </p>
        <BoutonReinscrire />
      </main>
    );
  }

  const [communicationsActif, partageEmployeurActif, autresInscriptions] = await Promise.all([
    estConsentementActif(contexte.participant.id, 'COMMUNICATIONS'),
    estConsentementActif(contexte.participant.id, 'PARTAGE_EMPLOYEUR', contexte.inscription.id),
    prisma.inscription.findMany({
      where: { participantId: contexte.participant.id, id: { not: contexte.inscription.id }, statut: { not: 'ANNULEE' } },
      include: { seminaire: { select: { titre: true, dateDebut: true, dateFin: true } } },
      orderBy: { seminaire: { dateDebut: 'desc' } },
    }),
  ]);

  const phase = calculerPhaseSeminaire(contexte.seminaire.dateDebut, contexte.seminaire.dateFin);
  // Supports visibles seulement PENDANT et APRÈS (contrainte du lot) —
  // inutile de charger la liste AVANT, où elle ne s'affiche jamais.
  const supports = phase !== 'AVANT' ? await listerSupportsVisibles(contexte.seminaire.id) : [];

  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      {contexte.inscription.statut === 'EN_ATTENTE' ? (
        <p className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-700)]">
          Votre inscription est en cours de validation par l&apos;organisateur. Vous recevrez votre accès dès que ce
          sera fait.
        </p>
      ) : null}

      <header>
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{contexte.seminaire.titre}</h1>
        <p className="text-[color:var(--gris-600)]">
          {formaterDateLongue(contexte.seminaire.dateDebut)} · {formaterHeure(contexte.seminaire.dateDebut)}–
          {formaterHeure(contexte.seminaire.dateFin)}
          {contexte.seminaire.lieu ? ` · ${contexte.seminaire.lieu}` : ''}
        </p>
      </header>

      {phase === 'AVANT' ? (
        <>
          <ProgrammeSeminaire modules={contexte.seminaire.modules} titreSection="Programme" />
          <a
            href={`/s/${contexte.seminaire.codePublic}/calendrier.ics`}
            className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 py-3 text-center text-[color:var(--gris-800)]"
          >
            Ajouter à mon calendrier
          </a>
          <BoutonAnnuler />
        </>
      ) : null}

      {phase === 'PENDANT' ? (
        <>
          <ProgrammeSeminaire modules={contexte.seminaire.modules} titreSection="Aujourd'hui" />
          <SectionSupports supports={supports} />
        </>
      ) : null}

      {phase === 'APRES' ? (
        <>
          <SectionSupports supports={supports} />
          <section className="rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
            <h2 className="text-[length:var(--taille-md)] mb-1">Votre avis nous intéresse</h2>
            <p className="text-[color:var(--gris-600)] mb-3">
              {contexte.inscription.aRepondu
                ? "Merci d'avoir répondu à notre questionnaire d'évaluation."
                : 'Aidez-nous à améliorer ce séminaire en répondant au questionnaire.'}
            </p>
            <a
              href="/mon-espace/questionnaire"
              className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--couleur-accent)] px-4 text-[color:var(--couleur-accent-contraste)]"
            >
              {contexte.inscription.aRepondu ? 'Voir mon évaluation' : 'Répondre au questionnaire'}
            </a>
          </section>
        </>
      ) : null}

      <a
        href="/mon-espace/messages"
        className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 py-3 text-center text-[color:var(--gris-800)]"
      >
        Envoyer un message anonyme
      </a>

      <section aria-label="Vos préférences" className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <h2 className="text-[length:var(--taille-md)]">Vos préférences</h2>
        <ToggleConsentement
          libelle="Recevoir des informations sur les prochaines formations"
          actif={communicationsActif}
          retirerAction={retirerCommunicationsAction}
          autoriserAction={autoriserCommunicationsAction}
        />
        <ToggleConsentement
          libelle="Partager ma présence avec l'employeur qui finance cette formation"
          actif={partageEmployeurActif}
          retirerAction={retirerPartageEmployeurAction}
          autoriserAction={autoriserPartageEmployeurAction}
        />
      </section>

      {autresInscriptions.length > 0 ? (
        <section aria-label="Vos autres séminaires">
          <h2 className="text-[length:var(--taille-md)] mb-2">Vos autres séminaires</h2>
          <ul className="flex flex-col gap-2">
            {autresInscriptions.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 text-[color:var(--gris-700)]">
                <span>{i.seminaire.titre}</span>
                <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
                  {calculerPhaseSeminaire(i.seminaire.dateDebut, i.seminaire.dateFin) === 'AVANT'
                    ? 'À venir'
                    : calculerPhaseSeminaire(i.seminaire.dateDebut, i.seminaire.dateFin) === 'PENDANT'
                      ? 'En cours'
                      : 'Terminé'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function SectionSupports({ supports }: { supports: { id: string; titre: string; tailleFichier: number }[] }) {
  return (
    <section className="rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="text-[length:var(--taille-md)] mb-1">Supports de formation</h2>
      {supports.length === 0 ? (
        <p className="text-[color:var(--gris-600)]">Les supports de ce séminaire seront mis à votre disposition ici.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {supports.map((support) => (
            <li key={support.id}>
              <a
                href={`/mon-espace/supports/${support.id}/fichier`}
                className="flex min-h-[44px] items-center justify-between gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] px-3 text-[color:var(--gris-900)]"
              >
                <span className="break-words">{support.titre}</span>
                <span className="chiffre shrink-0 text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
                  {formaterTaille(support.tailleFichier)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProgrammeSeminaire({
  modules,
  titreSection,
}: {
  modules: { id: string; titre: string; dureeMinutes: number }[];
  titreSection: string;
}) {
  if (modules.length === 0) return null;
  return (
    <section aria-label={titreSection}>
      <h2 className="text-[length:var(--taille-md)] mb-2">{titreSection}</h2>
      <ol className="flex flex-col gap-2">
        {modules.map((module, index) => (
          <li key={module.id} className="flex justify-between gap-2 text-[color:var(--gris-700)]">
            <span>
              {index + 1}. {module.titre}
            </span>
            <span className="chiffre text-[color:var(--gris-500)]">{module.dureeMinutes} min</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
