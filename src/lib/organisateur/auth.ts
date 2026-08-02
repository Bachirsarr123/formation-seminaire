import 'server-only';
import argon2 from 'argon2';
import { RoleUtilisateur } from '@prisma/client';
import { prisma } from '../prisma';
import { normaliserEmail } from '../normalisation';
import {
  enregistrerEchecConnexion,
  enregistrerTentativeGlobaleIP,
  reinitialiserTentativesConnexion,
  verifierLimiteGlobaleIP,
  verifierTentativeConnexion,
} from './verrouillage-connexion';

// Hash argon2id d'une valeur arbitraire, jamais un mot de passe réel : sert
// uniquement à ce qu'un email inconnu (ou un formateur sans mot de passe)
// suive EXACTEMENT le même chemin — un argon2.verify, qui domine le temps de
// réponse — qu'un email existant. Sans lui, la différence de latence entre
// "email inconnu" (retour immédiat) et "email connu" (argon2.verify, ~100ms)
// révélerait les comptes existants même si le message affiché reste identique.
const HASH_FACTICE =
  '$argon2id$v=19$m=65536,p=4,t=3$mpdaSYeDA7kRc6EKqMpuiA$ftFhyAfV7NAJKgeS58VmaUBtu132eltKGZjwDhfnrBc';

export class IdentifiantsInvalidesError extends Error {
  constructor() {
    super('Adresse e-mail ou mot de passe incorrect.');
    this.name = 'IdentifiantsInvalidesError';
  }
}

export class ConnexionTemporiseeError extends Error {
  // attenteMs = 0 : temporisation globale par IP (durée non précisée, fenêtre
  // glissante) — sinon, temps d'attente précis du verrou (email, IP).
  constructor(public readonly attenteMs: number) {
    super('Trop de tentatives. Réessayez plus tard.');
    this.name = 'ConnexionTemporiseeError';
  }
}

/**
 * Temps de réponse constant, y compris pour un email inconnu : on exécute
 * toujours exactement un argon2.verify, jamais de retour anticipé avant.
 */
export async function verifierIdentifiants(emailNormalise: string, motDePasse: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: emailNormalise },
    select: { id: true, motDePasseHash: true, actif: true, role: true },
  });

  const hashACompare = utilisateur?.motDePasseHash ?? HASH_FACTICE;
  const valide = await argon2.verify(hashACompare, motDePasse);

  if (
    !utilisateur ||
    !utilisateur.actif ||
    utilisateur.role !== RoleUtilisateur.ORGANISATEUR ||
    !utilisateur.motDePasseHash ||
    !valide
  ) {
    return null;
  }

  return utilisateur;
}

interface ConnecterOrganisateurParams {
  email: string;
  motDePasse: string;
  ip: string;
}

/**
 * Ne pose aucune session (pas de cookie) : orchestre les vérifications et
 * retourne l'identifiant de l'utilisateur authentifié. La création de
 * session (creerSessionOrganisateur, qui touche cookies()) reste à la
 * charge de l'appelant — une Server Action, jamais cette fonction — pour que
 * connecterOrganisateur reste testable sans contexte de requête Next.js.
 */
export async function connecterOrganisateur({
  email,
  motDePasse,
  ip,
}: ConnecterOrganisateurParams): Promise<{ utilisateurId: string }> {
  const emailNormalise = normaliserEmail(email) ?? '';

  if (!verifierLimiteGlobaleIP(ip)) {
    throw new ConnexionTemporiseeError(0);
  }
  enregistrerTentativeGlobaleIP(ip);

  const etat = await verifierTentativeConnexion(emailNormalise, ip);
  if (!etat.autorise) {
    throw new ConnexionTemporiseeError(etat.attenteMs);
  }

  const utilisateur = await verifierIdentifiants(emailNormalise, motDePasse);

  if (!utilisateur) {
    await enregistrerEchecConnexion(emailNormalise, ip);
    throw new IdentifiantsInvalidesError();
  }

  await reinitialiserTentativesConnexion(emailNormalise, ip);
  return { utilisateurId: utilisateur.id };
}
