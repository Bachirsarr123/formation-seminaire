import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { listerEquipe } from '@/lib/organisateur/equipe';
import { prisma } from '@/lib/prisma';
import { FormulaireCreerFormateur } from './formulaire-creer-formateur';
import { FormulaireCreerOrganisateur } from './formulaire-creer-organisateur';
import { BoutonDesactiver } from './bouton-desactiver';
import { BoutonModifierMembre } from './bouton-modifier-membre';
import { BoutonSupprimerMembre } from './bouton-supprimer-membre';
import { FormulaireCvFormateur } from './formulaire-cv-formateur';
import { FormulaireLogoCabinet } from './formulaire-logo-cabinet';
import { televerserCvAction, televerserLogoCabinetAction } from './actions';

const LIBELLE_ROLE = { ORGANISATEUR: 'Organisateur', FORMATEUR: 'Formateur' } as const;

// Réservée aux organisateurs — exigerContexteOrganisateur(['ORGANISATEUR'])
// lève RoleInsuffisantError pour un formateur (capté par error.tsx), le lien
// de navigation lui-même est masqué côté layout pour ce rôle.
export default async function PageEquipe() {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  const [membres, cabinet] = await Promise.all([
    listerEquipe(contexte.cabinetId),
    prisma.cabinet.findUniqueOrThrow({ where: { id: contexte.cabinetId }, select: { logoUrl: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Équipe</h1>

      <section className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Cabinet</h2>
        <div className="flex items-center gap-3">
          {cabinet.logoUrl ? (
            <span className="inline-flex h-[76px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/cabinet-logo/${contexte.cabinetId}?v=${encodeURIComponent(cabinet.logoUrl)}`}
                alt=""
                className="h-[60px] w-auto max-w-[200px] object-contain"
              />
            </span>
          ) : (
            <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Aucun logo téléversé pour l&apos;instant.</p>
          )}
        </div>
        <FormulaireLogoCabinet action={televerserLogoCabinetAction} aDejaUnLogo={cabinet.logoUrl !== null} />
      </section>

      <div className="flex flex-wrap gap-3">
        <FormulaireCreerFormateur />
        <FormulaireCreerOrganisateur />
      </div>

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
                  <div className="flex flex-col items-start gap-1">
                    <BoutonModifierMembre
                      utilisateurId={membre.id}
                      nom={membre.nom}
                      prenom={membre.prenom}
                      email={membre.email}
                    />
                    {/* Désactiver et Supprimer : jamais sur sa propre ligne —
                        voir AutoDesactivationError/AutoSuppressionError
                        (lib/organisateur/equipe.ts), dont ceci est la
                        première ligne de défense côté UI. */}
                    {membre.actif && membre.id !== contexte.utilisateurId ? (
                      <BoutonDesactiver utilisateurId={membre.id} />
                    ) : null}
                    {membre.id !== contexte.utilisateurId ? <BoutonSupprimerMembre utilisateurId={membre.id} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
