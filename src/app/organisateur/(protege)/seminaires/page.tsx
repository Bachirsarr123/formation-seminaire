import { StatutSeminaire } from '@prisma/client';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { listerSeminaires, type FiltresSeminaires } from '@/lib/organisateur/seminaires';
import { prisma } from '@/lib/prisma';
import { formaterDateLongue } from '@/lib/dates';
import { LIBELLE_STATUT_SEMINAIRE } from '@/lib/libelles';

interface Props {
  searchParams: Promise<{ statut?: string; periode?: string; formateur?: string; q?: string; page?: string }>;
}

const PAR_PAGE = 20;

function estStatutValide(valeur: string | undefined): valeur is StatutSeminaire {
  return !!valeur && valeur in StatutSeminaire;
}

function construireQuery(params: Record<string, string | undefined>, overrides: Record<string, string>): string {
  const qs = new URLSearchParams();
  for (const [cle, valeur] of Object.entries({ ...params, ...overrides })) {
    if (valeur) qs.set(cle, valeur);
  }
  return qs.toString();
}

export default async function PageSeminaires({ searchParams }: Props) {
  const contexte = await exigerContexteOrganisateur();
  const params = await searchParams;
  const estFormateur = contexte.role === 'FORMATEUR';

  const page = Math.max(1, Number(params.page) || 1);
  const filtres: FiltresSeminaires = {
    statut: estStatutValide(params.statut) ? params.statut : undefined,
    periode: params.periode === 'AVENIR' || params.periode === 'PASSE' ? params.periode : undefined,
    // Un formateur ne voit que ses propres séminaires — jamais contournable
    // par le filtre "formateur" du formulaire (ignoré s'il n'a pas ce rôle).
    formateurId: estFormateur ? contexte.utilisateurId : params.formateur || undefined,
    recherche: params.q || undefined,
  };

  const [{ items, total }, formateurs] = await Promise.all([
    listerSeminaires(contexte.cabinetId, filtres, { page, parPage: PAR_PAGE }),
    estFormateur
      ? Promise.resolve([])
      : prisma.utilisateur.findMany({
          where: { cabinetId: contexte.cabinetId, role: 'FORMATEUR', actif: true },
          select: { id: true, nom: true, prenom: true },
          orderBy: { nom: 'asc' },
        }),
  ]);

  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Séminaires</h1>
        {!estFormateur ? (
          <a
            href="/organisateur/seminaires/nouveau"
            className="inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--couleur-accent)] px-4 text-[color:var(--couleur-accent-contraste)]"
          >
            Nouveau séminaire
          </a>
        ) : null}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Recherche (titre)
          </label>
          <input id="q" type="text" name="q" defaultValue={params.q ?? ''} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="statut" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Statut
          </label>
          <select id="statut" name="statut" defaultValue={params.statut ?? ''}>
            <option value="">Tous</option>
            {Object.values(StatutSeminaire).map((s) => (
              <option key={s} value={s}>
                {LIBELLE_STATUT_SEMINAIRE[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="periode" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
            Période
          </label>
          <select id="periode" name="periode" defaultValue={params.periode ?? ''}>
            <option value="">Toutes</option>
            <option value="AVENIR">À venir</option>
            <option value="PASSE">Passés</option>
          </select>
        </div>
        {!estFormateur ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="formateur" className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
              Formateur
            </label>
            <select id="formateur" name="formateur" defaultValue={params.formateur ?? ''}>
              <option value="">Tous</option>
              {formateurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Filtrer
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[length:var(--taille-sm)]">
          <thead>
            <tr className="border-b border-[color:var(--gris-200)] text-[color:var(--gris-600)]">
              <th className="p-2">Titre</th>
              <th className="p-2">Dates</th>
              <th className="p-2">Lieu</th>
              <th className="p-2">Statut</th>
              <th className="p-2">Inscrits</th>
              <th className="p-2">Taux de réponse</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-[color:var(--gris-100)]">
                <td className="p-2">
                  <a href={`/organisateur/seminaires/${s.id}`} className="text-[color:var(--couleur-accent-texte)] underline">
                    {s.titre}
                  </a>
                </td>
                <td className="p-2 chiffre">
                  {formaterDateLongue(s.dateDebut)}
                  {s.dateDebut.toDateString() !== s.dateFin.toDateString() ? ` – ${formaterDateLongue(s.dateFin)}` : ''}
                </td>
                <td className="p-2">{s.lieu ?? '—'}</td>
                <td className="p-2">{LIBELLE_STATUT_SEMINAIRE[s.statut]}</td>
                <td className="p-2 chiffre">
                  {s.inscrits}
                  {s.capaciteMax !== null ? ` / ${s.capaciteMax}` : ''}
                </td>
                <td className="p-2 chiffre">{s.tauxReponse !== null ? `${Math.round(s.tauxReponse * 100)} %` : '—'}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[color:var(--gris-500)]">
                  Aucun séminaire ne correspond à ces critères.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {nbPages > 1 ? (
        <nav className="flex items-center justify-center gap-4 text-[length:var(--taille-sm)]">
          {page > 1 ? <a href={`?${construireQuery(params, { page: String(page - 1) })}`}>Précédent</a> : null}
          <span className="chiffre text-[color:var(--gris-600)]">
            {page} / {nbPages}
          </span>
          {page < nbPages ? <a href={`?${construireQuery(params, { page: String(page + 1) })}`}>Suivant</a> : null}
        </nav>
      ) : null}
    </div>
  );
}
