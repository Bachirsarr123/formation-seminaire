import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Jetons opaques à haute entropie générés côté serveur (session, réinitiali-
 * sation de mot de passe, lien magique) : un hash rapide non salé suffit pour
 * les stocker de façon sûre — à la différence d'un mot de passe (faible
 * entropie, need bcrypt/argon2), personne ne peut retrouver ces jetons par
 * dictionnaire. Le hash sert uniquement à ce qu'une fuite de la table ne
 * rende aucun jeton réutilisable tel quel.
 */
export function genererJetonOpaque(): string {
  return randomBytes(32).toString('base64url');
}

export function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

// Partagée entre réinitialisation de mot de passe et lien magique formateur :
// même famille de jeton à usage unique, même message générique (jamais de
// détail sur la raison précise — expiré, déjà utilisé, inexistant — qui
// aiderait à deviner la mécanique).
export class JetonInvalideError extends Error {
  constructor() {
    super('Ce lien est invalide ou a expiré.');
    this.name = 'JetonInvalideError';
  }
}
