import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { listerSeminairesAgenda, obtenirOuGenererJetonFluxIcs } from '@/lib/organisateur/agenda';
import { construireGrilleMois } from '@/lib/organisateur/grille-mois';
import { construireOrigineRequete } from '@/lib/origine-requete';
import { regenererJetonFluxIcsAction } from './actions';

interface Props {
  searchParams: Promise<{ mois?: string }>;
}

const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function moisCourant(): { annee: number; mois: number } {
  const maintenant = new Date();
  return { annee: maintenant.getUTCFullYear(), mois: maintenant.getUTCMonth() + 1 };
}

function formaterParametreMois({ annee, mois }: { annee: number; mois: number }): string {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}`;
}

export default async function PageAgenda({ searchParams }: Props) {
  const contexte = await exigerContexteOrganisateur();
  const params = await searchParams;
  const estFormateur = contexte.role === 'FORMATEUR';

  let { annee, mois } = moisCourant();
  if (params.mois && /^\d{4}-\d{2}$/.test(params.mois)) {
    const [a, m] = params.mois.split('-').map(Number);
    annee = a!;
    mois = m!;
  }

  const seminaires = await listerSeminairesAgenda(
    contexte.cabinetId,
    { annee, mois },
    { formateurId: estFormateur ? contexte.utilisateurId : undefined },
  );
  const semaines = construireGrilleMois(annee, mois, seminaires);

  const moisPrecedent = mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
  const moisSuivant = mois === 12 ? { annee: annee + 1, mois: 1 } : { annee, mois: mois + 1 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          {NOMS_MOIS[mois - 1]} {annee}
        </h1>
        <nav className="flex items-center gap-3 text-[length:var(--taille-sm)]">
          <a href={`?mois=${formaterParametreMois(moisPrecedent)}`}>← Précédent</a>
          <a href="/organisateur/seminaires">Vue liste</a>
          <a href={`?mois=${formaterParametreMois(moisSuivant)}`}>Suivant →</a>
        </nav>
      </div>

      {/* Grille mensuelle — masquée sur mobile : une grille à 320px est illisible. */}
      <div className="hidden md:flex md:flex-col md:gap-2">
        <div className="agenda-jours">
          {NOMS_JOURS.map((j) => (
            <div key={j} className="agenda-jour">
              {j}
            </div>
          ))}
        </div>
        {semaines.map((semaine) => (
          <div key={semaine.debut.toISOString()} className="agenda-semaine">
            <div className="agenda-jours">
              {semaine.jours.map((j) => (
                <div key={j.date.toISOString()} className={`agenda-jour${j.dansLeMois ? '' : ' agenda-jour--hors-mois'}`}>
                  {j.date.getUTCDate()}
                </div>
              ))}
            </div>
            <div className="agenda-bandeaux">
              {semaine.bandeaux.map((b) => (
                <a
                  key={b.seminaire.id}
                  href={`/organisateur/seminaires/${b.seminaire.id}`}
                  className="agenda-bandeau"
                  style={{ gridColumn: `${b.colDebut} / ${b.colFin}` }}
                >
                  {b.seminaire.titre}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Liste groupée par semaine — mobile uniquement. */}
      <div className="flex flex-col gap-4 md:hidden">
        {semaines.filter((s) => s.bandeaux.length > 0).length === 0 ? (
          <p className="text-[color:var(--gris-500)]">Aucun séminaire ce mois-ci.</p>
        ) : (
          semaines
            .filter((s) => s.bandeaux.length > 0)
            .map((semaine) => (
              <section key={semaine.debut.toISOString()}>
                <h2 className="mb-2 text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  Semaine du {semaine.jours[0]!.date.getUTCDate()} {NOMS_MOIS[semaine.jours[0]!.date.getUTCMonth()]}
                </h2>
                <ul className="flex flex-col gap-2">
                  {semaine.bandeaux.map((b) => (
                    <li key={b.seminaire.id}>
                      <a
                        href={`/organisateur/seminaires/${b.seminaire.id}`}
                        className="text-[color:var(--couleur-accent-texte)] underline"
                      >
                        {b.seminaire.titre}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))
        )}
      </div>

      {!estFormateur ? <SectionAbonnementIcs cabinetId={contexte.cabinetId} /> : null}
    </div>
  );
}

async function SectionAbonnementIcs({ cabinetId }: { cabinetId: string }) {
  const jetonFlux = await obtenirOuGenererJetonFluxIcs(cabinetId);
  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lienFlux = `${origine}/organisateur/seminaires/agenda.ics?jeton=${jetonFlux}`;

  return (
    <section className="rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
      <h2 className="mb-2 text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Abonnement agenda</h2>
      <p className="mb-2 text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
        Ajoutez cette adresse dans Outlook ou Google Agenda : tous les séminaires du cabinet s&apos;y mettront à jour
        automatiquement.
      </p>
      <p className="mb-3 break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienFlux}</p>
      <form action={regenererJetonFluxIcsAction}>
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Révoquer et générer un nouveau lien
        </button>
      </form>
      <p className="mt-2 text-[length:var(--taille-xs)] text-[color:var(--gris-500)]">
        L&apos;ancien lien cessera immédiatement de fonctionner — un abonnement déjà configuré devra être reconfiguré
        avec le nouveau.
      </p>
    </section>
  );
}
