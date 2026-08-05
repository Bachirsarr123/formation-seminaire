import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { listerModeles } from '@/lib/organisateur/questionnaires';
import { FormulaireCreerModele } from './formulaire-creer-modele';
import { dupliquerModeleAction, archiverModeleAction } from './actions';

// Réservée aux organisateurs — un formateur ne crée ni ne gère de modèle.
export default async function PageBibliothequeQuestionnaires() {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const modeles = await listerModeles(contexte.cabinetId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Questionnaires</h1>

      <FormulaireCreerModele />

      {modeles.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucun modèle pour l&apos;instant.</p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                <th className="p-2">Nom</th>
                <th className="p-2">Questions</th>
                <th className="p-2">Séminaires</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modeles.map((modele) => {
                const dupliquer = dupliquerModeleAction.bind(null, modele.id);
                const archiver = archiverModeleAction.bind(null, modele.id);
                return (
                  <tr key={modele.id} className="border-t border-[color:var(--gris-100)]">
                    <td className="p-2 text-[color:var(--gris-900)]">
                      <a href={`/organisateur/questionnaires/${modele.id}`} className="underline">
                        {modele.nom}
                      </a>
                    </td>
                    <td className="chiffre p-2 text-[color:var(--gris-700)]">{modele.nbQuestions}</td>
                    <td className="chiffre p-2 text-[color:var(--gris-700)]">{modele.nbSeminaires}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={dupliquer}>
                          <button
                            type="submit"
                            className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[color:var(--gris-800)]"
                          >
                            Dupliquer
                          </button>
                        </form>
                        <form action={archiver}>
                          <button
                            type="submit"
                            className="min-h-[44px] bg-transparent px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
                          >
                            Archiver
                          </button>
                        </form>
                      </div>
                    </td>
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
