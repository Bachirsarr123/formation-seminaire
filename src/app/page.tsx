import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { resoudreSessionOrganisateur } from '@/lib/organisateur/session';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';

/**
 * Point ouvert du lot 2 : le domaine nu ne menait nulle part. Trois états
 * (lot 4, point C) :
 *  - organisateur/formateur déjà connecté → redirection vers le tableau de bord ;
 *  - participant porteur d'un cookie valide → proposition de rejoindre son espace ;
 *  - visiteur anonyme → page sobre présentant le cabinet, accès discret à la connexion.
 *
 * Hypothèse assumée (à confirmer) : un déploiement sert un seul cabinet —
 * rien dans l'application ne résout de tenant par domaine/sous-domaine, et
 * le multi-cabinet du schéma sert avant tout à prouver l'isolation des
 * données (section B), pas à faire du multi-tenant actif sur un même domaine.
 * Faute d'autre signal, "le" cabinet de cette page est le plus ancien.
 */
export default async function PageAccueil() {
  const contexteOrganisateur = await resoudreSessionOrganisateur();
  if (contexteOrganisateur) {
    redirect('/organisateur');
  }

  const jetonParticipant = await lireJetonSession();
  const contexteParticipant = jetonParticipant ? await resoudreContexteParticipant(jetonParticipant) : null;

  const cabinet = await prisma.cabinet.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { nom: true, couleurPrimaire: true, emailContact: true },
  });

  const jetons = deriverJetonsAccent(cabinet?.couleurPrimaire ?? null);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  if (contexteParticipant) {
    return (
      <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-4">
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          {cabinet?.nom ?? 'Séminaires'}
        </h1>
        <p className="text-[color:var(--gris-700)]">
          Vous avez un espace personnel pour « {contexteParticipant.seminaire.titre} ».
        </p>
        <a
          href="/mon-espace"
          className="inline-flex min-h-[56px] items-center justify-center rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
        >
          Accéder à mon espace
        </a>
      </main>
    );
  }

  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{cabinet?.nom ?? 'Séminaires'}</h1>
      <p className="text-[color:var(--gris-700)]">Plateforme de gestion et d&apos;évaluation de séminaires.</p>
      {cabinet?.emailContact ? (
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Contact : {cabinet.emailContact}
        </p>
      ) : null}
      <a href="/organisateur/connexion" className="text-[length:var(--taille-sm)] text-[color:var(--couleur-accent-texte)] underline">
        Connexion organisateur
      </a>
    </main>
  );
}
