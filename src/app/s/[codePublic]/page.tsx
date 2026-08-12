import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { chargerSeminairePublic } from '@/lib/seminaire-public';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { LIBELLE_MODALITE } from '@/lib/libelles';
import { EnTeteLogos } from '@/components/en-tete-logos';

interface Props {
  params: Promise<{ codePublic: string }>;
}

export default async function PageSeminairePublic({ params }: Props) {
  const { codePublic } = await params;
  const resultat = await chargerSeminairePublic(codePublic);

  if (!resultat) {
    notFound();
  }

  const { seminaire, etat } = resultat;
  const jetons = deriverJetonsAccent(seminaire.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <EnTeteLogos cabinet={seminaire.cabinet} codePublic={codePublic} logoClientUrl={seminaire.logoClientUrl} />

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
        {seminaire.lieu || seminaire.tarif ? <p>{[seminaire.lieu, seminaire.tarif].filter(Boolean).join(' · ')}</p> : null}
        <p>{LIBELLE_MODALITE[seminaire.modalite] ?? seminaire.modalite}</p>
      </section>

      {seminaire.formateurs.length > 0 ? (
        <section aria-label="Formateurs">
          <h2 className="text-[length:var(--taille-md)] mb-2">Formateurs</h2>
          <ul className="flex flex-col gap-1 text-[color:var(--gris-700)]">
            {seminaire.formateurs.map((f) => (
              <li key={`${f.seminaireId}-${f.utilisateurId}`} className="flex items-center gap-2">
                <span>
                  {f.utilisateur.prenom} {f.utilisateur.nom}
                </span>
                {f.utilisateur.cvUrl ? (
                  <a
                    href={`/s/${codePublic}/formateurs/${f.utilisateurId}/cv`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[length:var(--taille-sm)] underline"
                  >
                    CV
                  </a>
                ) : null}
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

      <EtatInscription etat={etat.type} codePublic={codePublic} />
    </main>
  );
}

function EtatInscription({
  etat,
  codePublic,
}: {
  etat: 'OUVERTE' | 'TERMINE' | 'FERMEES' | 'INDISPONIBLE';
  codePublic: string;
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

  return <p className="mt-2 text-[color:var(--gris-600)]">Les inscriptions ne sont pas ouvertes pour le moment.</p>;
}
