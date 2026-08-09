import 'server-only';
import { Prisma, RoleUtilisateur, type Utilisateur } from '@prisma/client';
import { prisma } from '../prisma';

// ============================================================
// Gestion des comptes du cabinet (lot 4, étape 9, section formateurs) —
// même règle B que seminaires.ts/participants.ts : cabinetId obligatoire
// partout, appliqué en clause WHERE. Réservé au rôle ORGANISATEUR côté
// appelant (Server Actions), pas ici : cette lib ne connaît pas de rôle.
// ============================================================

export interface DonneesFormateur {
  nom: string;
  prenom: string;
  email: string;
}

export interface MembreEquipe {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: RoleUtilisateur;
  actif: boolean;
}

// email est unique GLOBALEMENT (schema.prisma : Utilisateur.email @unique,
// pas par cabinet) — un formateur ne peut pas partager son adresse avec un
// compte d'un autre cabinet, ni avec un autre compte du même cabinet.
export class EmailDejaUtiliseError extends Error {
  constructor() {
    super('Un compte existe déjà avec cet e-mail.');
    this.name = 'EmailDejaUtiliseError';
  }
}

// Filet de sécurité : dans l'écran, le bouton "Désactiver" n'apparaît jamais
// sur sa propre ligne (page.tsx), donc ce cas n'est normalement jamais
// atteint depuis l'UI — mais un organisateur qui se couperait lui-même
// l'accès (dernier compte actif du cabinet, session en cours) serait un
// verrou sans porte de sortie propre, pas un simple oubli à corriger plus
// tard.
export class AutoDesactivationError extends Error {
  constructor() {
    super('Impossible de désactiver votre propre compte.');
    this.name = 'AutoDesactivationError';
  }
}

/**
 * Organisateurs et formateurs du cabinet, actifs et désactivés confondus
 * (l'écran affiche le statut plutôt que de faire disparaître une ligne) —
 * actifs d'abord, puis organisateurs avant formateurs, puis alphabétique.
 */
export async function listerEquipe(cabinetId: string): Promise<MembreEquipe[]> {
  return prisma.utilisateur.findMany({
    where: { cabinetId },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    orderBy: [{ actif: 'desc' }, { role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  });
}

/**
 * Toujours FORMATEUR, jamais ORGANISATEUR : aucun écran de cet écran ne
 * crée de compte avec mot de passe (motDePasseHash reste null) — un
 * formateur ne se connecte jamais ; son seul accès est le lien direct
 * /f/{codeFormateur} généré par séminaire (lib/organisateur/seminaires.ts,
 * lib/formateur-lien.ts), pas un compte au sens propre.
 */
export async function creerFormateur(cabinetId: string, donnees: DonneesFormateur): Promise<Utilisateur> {
  try {
    return await prisma.utilisateur.create({
      data: {
        cabinetId,
        nom: donnees.nom,
        prenom: donnees.prenom,
        email: donnees.email,
        role: RoleUtilisateur.FORMATEUR,
        motDePasseHash: null,
      },
    });
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
      throw new EmailDejaUtiliseError();
    }
    throw erreur;
  }
}

/**
 * Désactivation seule, jamais de suppression : `actif = false` uniquement.
 * Une session déjà ouverte de ce compte cesse d'être valable dès la
 * prochaine résolution (resoudreSessionOrganisateur vérifie déjà
 * `utilisateur.actif`) — aucune purge de SessionOrganisateur nécessaire ici.
 *
 * `false` si la ressource n'existe pas ou appartient à un autre cabinet,
 * pour que l'appelant réponde 404 dans les deux cas indifféremment (règle B).
 */
export async function desactiverCompte(
  cabinetId: string,
  utilisateurId: string,
  initiateurId: string,
): Promise<boolean> {
  if (utilisateurId === initiateurId) throw new AutoDesactivationError();

  const resultat = await prisma.utilisateur.updateMany({
    where: { id: utilisateurId, cabinetId },
    data: { actif: false },
  });
  return resultat.count > 0;
}
