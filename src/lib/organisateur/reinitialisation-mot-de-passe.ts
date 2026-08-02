import 'server-only';
import argon2 from 'argon2';
import { RoleUtilisateur, TypeJetonAction } from '@prisma/client';
import { prisma } from '../prisma';
import { normaliserEmail } from '../normalisation';
import { JetonInvalideError, genererJetonOpaque, hacherJeton } from './jeton-hash';
import { envoyerLienReinitialisationMotDePasse } from '../notification';

const DUREE_JETON_MS = 60 * 60 * 1000; // 1h, usage unique

export { JetonInvalideError };

/**
 * Même réponse quel que soit le résultat (email inconnu, formateur sans mot
 * de passe, ou organisateur réel) : ne jamais confirmer l'existence d'un
 * compte par ce formulaire, classique vecteur d'énumération de comptes.
 * `origine` (protocole+host) est calculé par l'appelant (Server Action) —
 * cette fonction n'accède jamais à next/headers pour rester testable sans
 * contexte de requête.
 */
export async function demanderReinitialisation(email: string, origine: string): Promise<void> {
  const emailNormalise = normaliserEmail(email) ?? '';
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: emailNormalise },
    select: { id: true, nom: true, prenom: true, email: true, actif: true, role: true },
  });

  const eligible = utilisateur?.actif && utilisateur.role === RoleUtilisateur.ORGANISATEUR;
  if (!eligible || !utilisateur) return;

  const jeton = genererJetonOpaque();
  await prisma.jetonActionUtilisateur.create({
    data: {
      utilisateurId: utilisateur.id,
      type: TypeJetonAction.REINITIALISATION_MOT_DE_PASSE,
      tokenHash: hacherJeton(jeton),
      expiresAt: new Date(Date.now() + DUREE_JETON_MS),
    },
  });

  await envoyerLienReinitialisationMotDePasse(utilisateur, `${origine}/organisateur/connexion/reinitialiser/${jeton}`);
}

/**
 * Jeton à usage unique : consommé (utiliseLe posé) dans la même transaction
 * que le changement de mot de passe, avec destruction de toutes les sessions
 * ouvertes de ce compte — un mot de passe qui vient de fuiter suffisamment
 * pour justifier une réinitialisation ne doit laisser aucune session valide
 * ailleurs.
 */
export async function reinitialiserMotDePasse(jetonBrut: string, nouveauMotDePasse: string): Promise<void> {
  const ligne = await prisma.jetonActionUtilisateur.findUnique({ where: { tokenHash: hacherJeton(jetonBrut) } });

  if (
    !ligne ||
    ligne.type !== TypeJetonAction.REINITIALISATION_MOT_DE_PASSE ||
    ligne.utiliseLe !== null ||
    ligne.expiresAt < new Date()
  ) {
    throw new JetonInvalideError();
  }

  const motDePasseHash = await argon2.hash(nouveauMotDePasse);

  await prisma.$transaction([
    prisma.utilisateur.update({ where: { id: ligne.utilisateurId }, data: { motDePasseHash } }),
    prisma.jetonActionUtilisateur.update({ where: { id: ligne.id }, data: { utiliseLe: new Date() } }),
    prisma.sessionOrganisateur.deleteMany({ where: { utilisateurId: ligne.utilisateurId } }),
  ]);
}
