import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { listerEquipe } from '@/lib/organisateur/equipe';
import { FormulaireCreerFormateur } from './formulaire-creer-formateur';
import { BoutonDesactiver } from './bouton-desactiver';
import { FormulaireCvFormateur } from './formulaire-cv-formateur';
import { televerserCvAction } from './actions';

const LIBELLE_ROLE = { ORGANISATEUR: 'Organisateur', FORMATEUR: 'Formateur' } as const;

// Réservée aux organisateurs — exigerContexteOrganisateur(['ORGANISATEUR'])
// lève RoleInsuffisantError pour un formateur (capté par error.tsx), le lien
// de navigation lui-même est masqué côté layout pour ce rôle.
export default async function PageEquipe() {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const membres = await listerEquipe(contexte.cabinetId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Équipe</h1>

      <FormulaireCreerFormateur />

      {/* min-w-0 : voir le même commentaire sur le tableau participants —
          débordement horizontal trouvé à 320px/zoom 200% (étape 8). */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
              <th className="p-2">Nom</th>
              <th className="p-2">E-mail</th>
              <th className="p-2">Rôle</th>
              <th className="p-2">Statut</th>
              <th className="p-2">CV</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {membres.map((membre) => (
              <tr key={membre.id} className="border-t border-[color:var(--gris-100)]">
                <td className="p-2 text-[color:var(--gris-900)]">
                  {membre.prenom} {membre.nom}
                </td>
                <td className="p-2 text-[color:var(--gris-700)]">{membre.email}</td>
                <td className="p-2 text-[color:var(--gris-700)]">{LIBELLE_ROLE[membre.role]}</td>
                <td className="p-2 text-[color:var(--gris-700)]">{membre.actif ? 'Actif' : 'Désactivé'}</td>
                <td className="p-2">
                  {/* Sans objet pour un compte ORGANISATEUR — le CV n'a de
                      sens que pour un formateur. */}
                  {membre.role === 'FORMATEUR' ? (
                    <div className="flex flex-col gap-1">
                      {membre.cvUrl ? (
                        <a href={`/organisateur/equipe/${membre.id}/cv`} target="_blank" rel="noreferrer" className="text-[length:var(--taille-sm)] underline">
                          Voir le CV
                        </a>
                      ) : null}
                      <FormulaireCvFormateur action={televerserCvAction.bind(null, membre.id)} aDejaUnCv={membre.cvUrl !== null} />
                    </div>
                  ) : null}
                </td>
                <td className="p-2">
                  {/* Jamais sur sa propre ligne : voir AutoDesactivationError
                      (lib/organisateur/equipe.ts), dont ceci est la première
                      ligne de défense côté UI. */}
                  {membre.actif && membre.id !== contexte.utilisateurId ? (
                    <BoutonDesactiver utilisateurId={membre.id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
