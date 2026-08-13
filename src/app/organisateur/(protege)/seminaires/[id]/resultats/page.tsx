import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirResultatsSeminaire } from '@/lib/organisateur/resultats';
import { ResultatsSeminaire } from '@/components/resultats-seminaire';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';

// Accessible aux deux rôles, mais un formateur n'atteint que ses propres
// séminaires (vérifié dans obtenirResultatsSeminaire, pas ici) — une
// ressource hors périmètre est traitée exactement comme une ressource
// inexistante (règle B), jamais un 403.
export default async function PageResultats({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const vue = await obtenirResultatsSeminaire(contexte.cabinetId, id, contexte);
  if (!vue) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Résultats — {vue.seminaireTitre}</h1>

      <ResultatsSeminaire vue={vue} />

      {vue.visible ? (
        <section className="flex flex-wrap gap-3">
          <a href={`/organisateur/seminaires/${id}/resultats/export-agrege.csv`} className={CLASSE_BOUTON_TEXTE}>
            Exporter les résultats (CSV)
          </a>
          <a href={`/organisateur/seminaires/${id}/resultats/export-brut.csv`} className={CLASSE_BOUTON_TEXTE}>
            Exporter les réponses brutes anonymisées (CSV)
          </a>
        </section>
      ) : null}
    </div>
  );
}
