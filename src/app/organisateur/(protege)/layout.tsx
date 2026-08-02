import type { ReactNode } from 'react';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
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
    select: { nom: true },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--gris-100)] p-4">
        <span className="text-[length:var(--taille-md)] font-semibold text-[color:var(--gris-900)]">
          {cabinet.nom}
        </span>
        <nav className="flex items-center gap-4 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
          <a href="/organisateur/seminaires">Séminaires</a>
          <a href="/organisateur/seminaires/agenda">Agenda</a>
          <form action={deconnecterAction}>
            <button type="submit" className="text-[color:var(--gris-600)] underline">
              Se déconnecter
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
