import { notFound } from 'next/navigation';
import { StatutInscription } from '@prisma/client';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { listerInscriptionsSeminaire } from '@/lib/organisateur/participants';
import { LIBELLE_SOURCE_INSCRIPTION, LIBELLE_STATUT_INSCRIPTION } from '@/lib/libelles';
import { formaterDateCourte } from '@/lib/dates';
import { FormulaireAjoutParticipant } from './formulaire-ajout-participant';
import { BoutonRegenererJeton } from './bouton-regenerer-jeton';
import { annulerInscriptionAction, refuserInscriptionAction, validerInscriptionAction } from './actions';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ statut?: string }>;
}

const STATUTS_FILTRABLES = Object.values(StatutInscription);

// Une ressource d'un autre cabinet est traitée comme inexistante (règle B) :
// notFound() dans les deux cas, jamais un 403.
export default async function PageParticipants({ params, searchParams }: Props) {
  const { id } = await params;
  const { statut: statutBrut } = await searchParams;
  const contexte = await exigerContexteOrganisateur();
  const estFormateur = contexte.role === 'FORMATEUR';

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  // Une seule lecture, non filtrée : la jauge (calculée sur l'ensemble) et le
  // tableau affiché (filtré ci-dessous en mémoire) en partagent le résultat,
  // pas de second aller-retour en base pour un volume par séminaire borné
  // par capaciteMax.
  const inscriptions = await listerInscriptionsSeminaire(contexte.cabinetId, id);
  if (inscriptions === null) notFound();

  const occupees = inscriptions.filter((i) => i.statut === 'CONFIRMEE' || i.statut === 'EN_ATTENTE').length;

  const filtreStatut = STATUTS_FILTRABLES.includes(statutBrut as StatutInscription)
    ? (statutBrut as StatutInscription)
    : undefined;
  const inscriptionsAffichees = filtreStatut ? inscriptions.filter((i) => i.statut === filtreStatut) : inscriptions;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
            Participants — {seminaire.titre}
          </h1>
          <p className="chiffre text-[color:var(--gris-600)]">
            {occupees} inscrit{occupees > 1 ? 's' : ''}
            {seminaire.capaciteMax !== null ? ` / ${seminaire.capaciteMax}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!estFormateur ? (
            <a
              href={`/organisateur/seminaires/${id}/participants/import`}
              className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
            >
              Importer un CSV
            </a>
          ) : null}
          <a
            href={`/organisateur/seminaires/${id}/participants/export`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
          >
            Exporter en CSV
          </a>
        </div>
      </div>

      <nav className="flex flex-wrap gap-4 text-[length:var(--taille-sm)]">
        <a
          href={`/organisateur/seminaires/${id}/participants`}
          className={!filtreStatut ? 'font-semibold text-[color:var(--gris-900)]' : 'text-[color:var(--gris-600)] underline'}
        >
          Tous
        </a>
        {STATUTS_FILTRABLES.map((s) => (
          <a
            key={s}
            href={`/organisateur/seminaires/${id}/participants?statut=${s}`}
            className={filtreStatut === s ? 'font-semibold text-[color:var(--gris-900)]' : 'text-[color:var(--gris-600)] underline'}
          >
            {LIBELLE_STATUT_INSCRIPTION[s]}
          </a>
        ))}
      </nav>

      {!estFormateur ? <FormulaireAjoutParticipant seminaireId={id} /> : null}

      {inscriptionsAffichees.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucun participant{filtreStatut ? ' pour ce statut' : ''}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                <th className="p-2">Nom</th>
                <th className="p-2">Contact</th>
                <th className="p-2">Fonction</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Source</th>
                <th className="p-2">Inscrit le</th>
                <th className="p-2">A répondu</th>
                {!estFormateur ? <th className="p-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {inscriptionsAffichees.map((inscription) => {
                const valider = validerInscriptionAction.bind(null, id, inscription.id);
                const refuser = refuserInscriptionAction.bind(null, id, inscription.id);
                const annuler = annulerInscriptionAction.bind(null, id, inscription.id);
                return (
                  <tr key={inscription.id} className="border-t border-[color:var(--gris-100)]">
                    <td className="p-2 text-[color:var(--gris-900)]">
                      {inscription.participant.prenom} {inscription.participant.nom}
                    </td>
                    <td className="p-2 text-[color:var(--gris-700)]">
                      {inscription.participant.email ?? inscription.participant.telephone ?? '—'}
                    </td>
                    <td className="p-2 text-[color:var(--gris-700)]">
                      {[inscription.participant.fonction, inscription.participant.organisation].filter(Boolean).join(' · ') ||
                        '—'}
                    </td>
                    <td className="p-2 text-[color:var(--gris-700)]">{LIBELLE_STATUT_INSCRIPTION[inscription.statut]}</td>
                    <td className="p-2 text-[color:var(--gris-700)]">{LIBELLE_SOURCE_INSCRIPTION[inscription.source]}</td>
                    <td className="chiffre p-2 text-[color:var(--gris-700)]">{formaterDateCourte(inscription.dateInscription)}</td>
                    <td className="p-2 text-[color:var(--gris-700)]">{inscription.aRepondu ? 'Oui' : 'Non'}</td>
                    {!estFormateur ? (
                      <td className="p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {inscription.statut === 'EN_ATTENTE' ? (
                            <>
                              <form action={valider}>
                                <button
                                  type="submit"
                                  className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[color:var(--gris-800)]"
                                >
                                  Valider
                                </button>
                              </form>
                              <form action={refuser}>
                                <button
                                  type="submit"
                                  className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[color:var(--gris-800)]"
                                >
                                  Refuser
                                </button>
                              </form>
                            </>
                          ) : null}
                          {inscription.statut !== 'ANNULEE' ? (
                            <form action={annuler}>
                              <button
                                type="submit"
                                className="min-h-[44px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
                              >
                                Annuler
                              </button>
                            </form>
                          ) : null}
                          <BoutonRegenererJeton seminaireId={id} inscriptionId={inscription.id} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
