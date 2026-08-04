import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { LIBELLE_MODALITE, LIBELLE_STATUT_SEMINAIRE } from '@/lib/libelles';
import { formaterDateLongue, formaterHeure } from '@/lib/dates';
import { dupliquerSeminaireAction } from './actions';
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
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{seminaire.titre}</h1>
        {!estFormateur ? (
          <div className="flex flex-wrap gap-3">
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
          </div>
        ) : null}
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

      {seminaire.formateurs.length > 0 ? (
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

      {!estFormateur ? <BoutonSupprimer seminaireId={seminaire.id} /> : null}
    </div>
  );
}
