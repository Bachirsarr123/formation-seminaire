import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { RoleUtilisateur } from '@prisma/client';
import { prisma } from '../prisma';
import { genererJetonOpaque, hacherJeton } from './jeton-hash';
import { DUREE_SESSION_MS, NOM_COOKIE_SESSION } from './cookie-session';

export interface ContexteOrganisateur {
  utilisateurId: string;
  cabinetId: string;
  role: RoleUtilisateur;
}

export class RoleInsuffisantError extends Error {
  constructor() {
    super("Ce compte n'a pas le rôle requis pour cette action.");
    this.name = 'RoleInsuffisantError';
  }
}

/**
 * Pose le cookie de session (httpOnly, secure, sameSite=lax) et la ligne
 * SessionOrganisateur correspondante. Seul le hash du jeton est stocké en
 * base — voir jeton-hash.ts. À appeler uniquement depuis une Server Action
 * ou un Route Handler (restriction Next.js sur l'écriture de cookies),
 * jamais depuis le rendu d'une page.
 */
export async function creerSessionOrganisateur(utilisateurId: string): Promise<void> {
  const jeton = genererJetonOpaque();
  const expiresAt = new Date(Date.now() + DUREE_SESSION_MS);

  await prisma.sessionOrganisateur.create({
    data: { utilisateurId, tokenHash: hacherJeton(jeton), expiresAt },
  });

  const magasin = await cookies();
  magasin.set(NOM_COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_SESSION_MS / 1000,
  });
}

/**
 * Fonction UNIQUE de résolution de session (règle B du lot 4) : toute page
 * ou action de l'espace organisateur doit en passer par elle, jamais par une
 * lecture directe du cookie ou de la table. Mémoïsée par requête (comme
 * resoudreContexteParticipant) : plusieurs appels dans le même rendu ne
 * déclenchent qu'une seule lecture/écriture.
 *
 * Prolonge `expiresAt` en base à chaque résolution réussie (session
 * glissante) — mais ne réécrit jamais le cookie lui-même ici : `cookies().set`
 * est interdit hors Server Action/Route Handler, et cette fonction est aussi
 * appelée depuis de simples pages. Le rafraîchissement du cookie côté
 * navigateur est assuré par le Middleware (voir middleware.ts) sur
 * /organisateur/*, de façon purement optimiste ; la validité réelle reste
 * tranchée ici, contre la base.
 */
export const resoudreSessionOrganisateur = cache(async (): Promise<ContexteOrganisateur | null> => {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (!jeton) return null;

  const session = await prisma.sessionOrganisateur.findUnique({
    where: { tokenHash: hacherJeton(jeton) },
    include: { utilisateur: { select: { id: true, cabinetId: true, role: true, actif: true } } },
  });

  if (!session || session.expiresAt < new Date() || !session.utilisateur.actif) {
    return null;
  }

  await prisma.sessionOrganisateur.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + DUREE_SESSION_MS) },
  });

  return {
    utilisateurId: session.utilisateur.id,
    cabinetId: session.utilisateur.cabinetId,
    role: session.utilisateur.role,
  };
});

/**
 * Détruit réellement la session côté serveur (supprime la ligne en base),
 * pas seulement le cookie côté client — un jeton volé avant déconnexion ne
 * doit plus jamais être valide après.
 */
export async function detruireSessionOrganisateur(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE_SESSION)?.value;

  if (jeton) {
    await prisma.sessionOrganisateur.deleteMany({ where: { tokenHash: hacherJeton(jeton) } });
  }

  magasin.delete(NOM_COOKIE_SESSION);
}

/**
 * Garde commune à toute page/action de l'espace organisateur. Redirige vers
 * la connexion si aucune session valide ; lève RoleInsuffisantError (jamais
 * une redirection silencieuse) si la session est valide mais le rôle ne
 * convient pas à l'action demandée — être connecté et ne pas avoir le droit
 * ne sont pas la même situation pour l'appelant.
 */
export async function exigerContexteOrganisateur(rolesAutorises?: RoleUtilisateur[]): Promise<ContexteOrganisateur> {
  const contexte = await resoudreSessionOrganisateur();
  if (!contexte) {
    redirect('/organisateur/connexion');
  }
  if (rolesAutorises && !rolesAutorises.includes(contexte.role)) {
    throw new RoleInsuffisantError();
  }
  return contexte;
}
