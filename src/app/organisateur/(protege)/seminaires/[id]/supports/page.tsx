import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { listerSupports } from '@/lib/organisateur/supports';
import { ajouterSupportAction, basculerVisibiliteAction, deplacerSupportAction, supprimerSupportAction } from './actions';
import { FormulaireUploadSupport } from './formulaire-upload-support';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_ICONE =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] text-[color:var(--gris-800)]';
const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';
const CLASSE_BOUTON_SUPPRIMER = 'min-h-[44px] bg-transparent px-2 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline';

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// Réservée aux organisateurs (même discipline que import CSV/bibliothèque de
// modèles) : gestion administrative du séminaire, jamais déléguée au
// formateur.
export default async function PageSupports({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const supports = await listerSupports(contexte.cabinetId, id);
  if (supports === null) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Supports de cours</h1>
        <p className="text-[color:var(--gris-600)]">{seminaire.titre}</p>
      </div>

      {supports.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucun support pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {supports.map((support) => (
            <li
              key={support.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3"
            >
              <div className="min-w-0">
                <a
                  href={`/organisateur/seminaires/${id}/supports/${support.id}/fichier`}
                  className="break-words text-[color:var(--gris-900)] underline"
                >
                  {support.titre}
                </a>
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  {support.nomFichier} — <span className="chiffre">{formaterTaille(support.tailleFichier)}</span> —{' '}
                  {support.visibleParticipants ? 'Visible des participants' : 'Masqué aux participants'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={deplacerSupportAction.bind(null, id, support.id, 'HAUT')}>
                  <button type="submit" aria-label="Monter" className={CLASSE_BOUTON_ICONE}>
                    ↑
                  </button>
                </form>
                <form action={deplacerSupportAction.bind(null, id, support.id, 'BAS')}>
                  <button type="submit" aria-label="Descendre" className={CLASSE_BOUTON_ICONE}>
                    ↓
                  </button>
                </form>
                <form action={basculerVisibiliteAction.bind(null, id, support.id, !support.visibleParticipants)}>
                  <button type="submit" className={CLASSE_BOUTON_TEXTE}>
                    {support.visibleParticipants ? 'Masquer' : 'Rendre visible'}
                  </button>
                </form>
                <form action={supprimerSupportAction.bind(null, id, support.id)}>
                  <button type="submit" className={CLASSE_BOUTON_SUPPRIMER}>
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormulaireUploadSupport action={ajouterSupportAction.bind(null, id)} />
    </div>
  );
}
