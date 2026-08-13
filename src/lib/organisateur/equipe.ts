import 'server-only';
import argon2 from 'argon2';
import { Prisma, RoleUtilisateur, type Utilisateur } from '@prisma/client';
import { prisma } from '../prisma';

// ============================================================
// Gestion des comptes du cabinet (lot 4, étape 9, section formateurs ;
// étendu ensuite à l'ajout d'organisateurs, la modification et la
// suppression des deux rôles) — même règle B que seminaires.ts/
// participants.ts : cabinetId obligatoire partout, appliqué en clause
// WHERE. Réservé au rôle ORGANISATEUR côté appelant (Server Actions), pas
// ici : cette lib ne connaît pas de rôle appelant.
// ============================================================

export interface DonneesFormateur {
  nom: string;
  prenom: string;
  email: string;
}

export interface DonneesOrganisateur {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
}

export interface DonneesModificationMembre {
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
  cvUrl: string | null;
}

// email est unique GLOBALEMENT (schema.prisma : Utilisateur.email @unique,
// pas par cabinet) — un membre ne peut pas partager son adresse avec un
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

// Même filet que ci-dessus, pour la suppression : le bouton "Supprimer"
// est lui aussi absent de sa propre ligne (page.tsx).
export class AutoSuppressionError extends Error {
  constructor() {
    super('Impossible de supprimer votre propre compte.');
    this.name = 'AutoSuppressionError';
  }
}

// Contrairement à la désactivation (jamais bloquée), la suppression d'un
// organisateur peut faire tomber le cabinet à zéro compte actif capable de
// se connecter — un verrou total, sans porte de sortie (aucun écran ne
// réactive un compte désactivé, donc aucun ne recrée un accès perdu). La
// désactivation seule n'a pas ce garde-fou (POINTS-OUVERTS.md, décision
// assumée) ; la suppression, irréversible, l'exige.
export class DernierOrganisateurActifError extends Error {
  constructor() {
    super("Impossible de supprimer le dernier compte organisateur actif du cabinet.");
    this.name = 'DernierOrganisateurActifError';
  }
}

// Levée quand la ligne a des données associées protégées par une contrainte
// de clé étrangère (ex. Notation.formateur, onDelete: Restrict — une
// notation est une pièce d'audit qui ne doit jamais disparaître
// silencieusement, voir schema.prisma). La désactivation reste possible
// dans ce cas, elle est proposée comme solution de repli dans le message.
export class SuppressionImpossibleError extends Error {
  constructor() {
    super("Ce compte a des données associées (notations, séminaires...) et ne peut pas être supprimé — désactivez-le à la place.");
    this.name = 'SuppressionImpossibleError';
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
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, cvUrl: true },
    orderBy: [{ actif: 'desc' }, { role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  });
}

/**
 * Toujours FORMATEUR, jamais ORGANISATEUR : aucun mot de passe (motDePasseHash
 * reste null) — un formateur ne se connecte jamais ; son seul accès est le
 * lien direct /f/{codeFormateur} généré par séminaire
 * (lib/organisateur/seminaires.ts, lib/formateur-lien.ts), pas un compte au
 * sens propre.
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
 * Toujours ORGANISATEUR, avec mot de passe (seul rôle qui se connecte —
 * même hachage argon2id que reinitialisation-mot-de-passe.ts et le script
 * d'initialisation de production). Actif dès la création : aucun écran ne
 * repose `actif` à `true`, un compte créé désactivé serait un compte mort.
 */
export async function creerOrganisateur(cabinetId: string, donnees: DonneesOrganisateur): Promise<Utilisateur> {
  const motDePasseHash = await argon2.hash(donnees.motDePasse);
  try {
    return await prisma.utilisateur.create({
      data: {
        cabinetId,
        nom: donnees.nom,
        prenom: donnees.prenom,
        email: donnees.email,
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash,
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
 * Modifie nom/prénom/e-mail, quel que soit le rôle — jamais le mot de passe
 * (repasse par le flux de réinitialisation dédié, pas cet écran) ni le rôle
 * (une conversion formateur <-> organisateur n'a pas été demandée et
 * changerait la nature du compte — mot de passe à poser/retirer, lien
 * /f/{code} à révoquer... hors du périmètre d'une simple modification de
 * fiche).
 *
 * `false` si le compte n'existe pas ou appartient à un autre cabinet, pour
 * que l'appelant réponde 404 dans les deux cas (règle B).
 */
export async function modifierMembre(
  cabinetId: string,
  utilisateurId: string,
  donnees: DonneesModificationMembre,
): Promise<boolean> {
  try {
    const resultat = await prisma.utilisateur.updateMany({
      where: { id: utilisateurId, cabinetId },
      data: { nom: donnees.nom, prenom: donnees.prenom, email: donnees.email },
    });
    return resultat.count > 0;
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

/**
 * Suppression PHYSIQUE — contrairement à la désactivation, irréversible.
 * Deux garde-fous avant toute tentative :
 *   - jamais son propre compte (AutoSuppressionError) ;
 *   - jamais le dernier organisateur actif du cabinet (DernierOrganisateurActifError),
 *     qui couperait tout accès futur à l'espace organisateur.
 * Si la ligne a des données associées protégées par une contrainte de clé
 * étrangère (Restrict — ex. Notation.formateur), Postgres refuse le DELETE :
 * intercepté ici (P2003) et retraduit en SuppressionImpossibleError, jamais
 * une erreur Postgres brute.
 *
 * `false` si la ressource n'existe pas ou appartient à un autre cabinet
 * (règle B).
 */
export async function supprimerMembre(
  cabinetId: string,
  utilisateurId: string,
  initiateurId: string,
): Promise<boolean> {
  if (utilisateurId === initiateurId) throw new AutoSuppressionError();

  const cible = await prisma.utilisateur.findFirst({
    where: { id: utilisateurId, cabinetId },
    select: { id: true, role: true, actif: true },
  });
  if (!cible) return false;

  if (cible.role === RoleUtilisateur.ORGANISATEUR && cible.actif) {
    const autresOrganisateursActifs = await prisma.utilisateur.count({
      where: { cabinetId, role: RoleUtilisateur.ORGANISATEUR, actif: true, id: { not: utilisateurId } },
    });
    if (autresOrganisateursActifs === 0) throw new DernierOrganisateurActifError();
  }

  try {
    await prisma.utilisateur.delete({ where: { id: utilisateurId } });
    return true;
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2003') {
      throw new SuppressionImpossibleError();
    }
    throw erreur;
  }
}
