import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { listerModeles } from '@/lib/organisateur/questionnaires';
import { choisirModeleAction } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

// Réservée aux organisateurs. Le choix déclenche copierModeleVersSeminaire
// (inchangé, déjà existant) puis ouvre l'éditeur sur la copie — que
// l'organisateur adapte librement (lot 5, section « Rattachement »).
export default async function PageChoisirModele({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const modeles = await listerModeles(contexte.cabinetId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
        Choisir un modèle — {seminaire.titre}
      </h1>

      {modeles.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">
          Aucun modèle dans la bibliothèque du cabinet.{' '}
          <a href="/organisateur/questionnaires" className="underline">
            Créer un modèle
          </a>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {modeles.map((modele) => (
            <li
              key={modele.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4"
            >
              <div>
                <p className="text-[color:var(--gris-900)]">{modele.nom}</p>
                <p className="chiffre text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  {modele.nbQuestions} question{modele.nbQuestions > 1 ? 's' : ''}
                </p>
              </div>
              <form action={choisirModeleAction.bind(null, id, modele.id)}>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
                >
                  Choisir
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
