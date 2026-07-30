import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { chargerSeminairePublic } from '@/lib/seminaire-public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { LIBELLE_MODALITE } from '@/lib/libelles';

interface Props {
  params: Promise<{ codePublic: string }>;
}

export default async function PageSeminairePublic({ params }: Props) {
  const { codePublic } = await params;
  const resultat = await chargerSeminairePublic(codePublic);

  if (!resultat) {
    notFound();
  }

  const { seminaire, placesRestantes, etat } = resultat;
  const jetons = deriverJetonsAccent(seminaire.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <header className="flex items-center gap-3">
        {seminaire.cabinet.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seminaire.cabinet.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : null}
        <span className="text-[color:var(--gris-600)] text-[length:var(--taille-sm)]">{seminaire.cabinet.nom}</span>
      </header>

      <div>
        <h1 className="text-[length:var(--taille-xl)] leading-[var(--interligne-xl)] text-[color:var(--gris-900)]">
          {seminaire.titre}
        </h1>
        {seminaire.description ? (
          <p className="mt-2 text-[color:var(--gris-700)]">{seminaire.description}</p>
        ) : null}
      </div>

      <section aria-label="Informations pratiques" className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p>
          <span className="font-medium">{formaterDateLongue(seminaire.dateDebut)}</span>
          {' · '}
          {formaterHeure(seminaire.dateDebut)}–{formaterHeure(seminaire.dateFin)}
        </p>
        {seminaire.lieu ? <p>{seminaire.lieu}</p> : null}
        <p>{LIBELLE_MODALITE[seminaire.modalite] ?? seminaire.modalite}</p>
        {placesRestantes !== null ? (
          <p className="chiffre text-[color:var(--gris-600)]">
            {placesRestantes > 0 ? `${placesRestantes} place${placesRestantes > 1 ? 's' : ''} restante${placesRestantes > 1 ? 's' : ''}` : 'Complet'}
          </p>
        ) : null}
      </section>

      {seminaire.formateurs.length > 0 ? (
        <section aria-label="Formateurs">
          <h2 className="text-[length:var(--taille-md)] mb-2">Formateurs</h2>
          <ul className="flex flex-col gap-1 text-[color:var(--gris-700)]">
            {seminaire.formateurs.map((f) => (
              <li key={`${f.seminaireId}-${f.utilisateurId}`}>
                {f.utilisateur.prenom} {f.utilisateur.nom}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {seminaire.modules.length > 0 ? (
        <section aria-label="Programme">
          <h2 className="text-[length:var(--taille-md)] mb-2">Programme</h2>
          <ol className="flex flex-col gap-2">
            {seminaire.modules.map((module, index) => (
              <li key={module.id} className="flex justify-between gap-2 text-[color:var(--gris-700)]">
                <span>
                  {index + 1}. {module.titre}
                </span>
                <span className="chiffre text-[color:var(--gris-500)]">{module.dureeMinutes} min</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <EtatInscription
        etat={etat.type}
        codePublic={codePublic}
        emailContact={seminaire.cabinet.emailContact}
        telephoneContact={seminaire.cabinet.telephoneContact}
      />
    </main>
  );
}

function EtatInscription({
  etat,
  codePublic,
  emailContact,
  telephoneContact,
}: {
  etat: 'OUVERTE' | 'TERMINE' | 'FERMEES' | 'COMPLET' | 'INDISPONIBLE';
  codePublic: string;
  emailContact: string | null;
  telephoneContact: string | null;
}) {
  if (etat === 'OUVERTE') {
    return (
      <Link
        href={`/s/${codePublic}/inscription`}
        className="mt-2 flex min-h-[56px] items-center justify-center rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Je m&apos;inscris
      </Link>
    );
  }

  if (etat === 'TERMINE') {
    return <p className="mt-2 text-[color:var(--gris-600)]">Ce séminaire est terminé.</p>;
  }

  if (etat === 'FERMEES') {
    return <p className="mt-2 text-[color:var(--gris-600)]">Les inscriptions pour ce séminaire sont fermées.</p>;
  }

  if (etat === 'COMPLET') {
    return (
      <div className="mt-2 flex flex-col gap-1 text-[color:var(--gris-600)]">
        <p>Ce séminaire est complet.</p>
        {emailContact ? (
          <p>
            Pour toute question,{' '}
            <a href={`mailto:${emailContact}`} className="underline">
              contactez-nous
            </a>
            .
          </p>
        ) : null}
        {telephoneContact ? <p>{telephoneContact}</p> : null}
      </div>
    );
  }

  return <p className="mt-2 text-[color:var(--gris-600)]">Les inscriptions ne sont pas ouvertes pour le moment.</p>;
}
