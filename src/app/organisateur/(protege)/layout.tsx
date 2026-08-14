import type { CSSProperties, ReactNode } from 'react';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { deconnecterAction } from '../deconnexion/actions';

/**
 * Groupe de routes `(protege)` : ne modifie pas les URLs (/organisateur,
 * /organisateur/seminaires, ...) mais isole ce layout — qui EXIGE une
 * session — des pages `connexion/*` et `deconnexion/*`, restées en dehors du
 * groupe. Un layout posé directement sur /organisateur aurait aussi enveloppé
 * /organisateur/connexion et bouclé indéfiniment (redirection vers une page
 * qu'il protège lui-même).
 */
export default async function LayoutOrganisateurProtege({ children }: { children: ReactNode }) {
  const contexte = await exigerContexteOrganisateur();
  const cabinet = await prisma.cabinet.findUniqueOrThrow({
    where: { id: contexte.cabinetId },
    select: { nom: true, couleurPrimaire: true },
  });

  // Jusqu'ici l'espace organisateur restait entièrement gris : aucune page
  // n'injectait les jetons dérivés de la couleur du cabinet (contrairement
  // aux pages publiques), donc tout bouton/accent y retombait sur la valeur
  // par défaut de globals.css. Posé ici, sur le layout racine protégé, la
  // couleur du cabinet se propage à tout l'espace organisateur en une seule
  // fois — cohérent avec l'identité déjà visible côté participants.
  const style = stylesJetonsAccent(deriverJetonsAccent(cabinet.couleurPrimaire)) as CSSProperties;

  return (
    <div style={style} className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[color:var(--couleur-accent)] bg-[color:var(--gris-000)] p-4">
        <span className="text-[length:var(--taille-md)] font-semibold text-[color:var(--gris-900)]">
          {cabinet.nom}
        </span>
        <nav className="flex flex-wrap items-center gap-4 text-[length:var(--taille-sm)] font-medium text-[color:var(--gris-700)]">
          <a href="/organisateur/seminaires" className="hover:text-[color:var(--couleur-accent-texte)]">Séminaires</a>
          <a href="/organisateur/seminaires/agenda" className="hover:text-[color:var(--couleur-accent-texte)]">Agenda</a>
          {contexte.role === 'ORGANISATEUR' ? (
            <a href="/organisateur/questionnaires" className="hover:text-[color:var(--couleur-accent-texte)]">Questionnaires</a>
          ) : null}
          {contexte.role === 'ORGANISATEUR' ? (
            <a href="/organisateur/equipe" className="hover:text-[color:var(--couleur-accent-texte)]">Équipe</a>
          ) : null}
          <form action={deconnecterAction}>
            <button type="submit" className="text-[color:var(--gris-600)] underline">
              Se déconnecter
            </button>
          </form>
        </nav>
      </header>
      {/* min-w-0 : un enfant flex a par défaut min-width:auto, qui l'empêche
          de rétrécir sous la largeur intrinsèque de son contenu (un titre
          long, un tableau large) — trouvé en testant un débordement
          horizontal à 320px/zoom 200% (étape 8), pas visible aux tailles
          usuelles. */}
      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
