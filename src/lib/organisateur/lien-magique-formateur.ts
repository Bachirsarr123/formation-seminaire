import 'server-only';
import { RoleUtilisateur, TypeJetonAction } from '@prisma/client';
import { prisma } from '../prisma';
import { normaliserEmail } from '../normalisation';
import { JetonInvalideError, genererJetonOpaque, hacherJeton } from './jeton-hash';
import { envoyerLienMagiqueFormateur } from '../notification';

export { JetonInvalideError };

const DUREE_JETON_MS = 15 * 60 * 1000; // 15 min, usage unique

/**
 * Même réponse quel que soit le résultat (email inconnu, organisateur avec
 * mot de passe, ou formateur réel) : même discipline de non-énumération que
 * la réinitialisation de mot de passe.
 */
export async function demanderLienMagique(email: string, origine: string): Promise<void> {
  const emailNormalise = normaliserEmail(email) ?? '';
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: emailNormalise },
    select: { id: true, nom: true, prenom: true, email: true, actif: true, role: true },
  });

  const eligible = utilisateur?.actif && utilisateur.role === RoleUtilisateur.FORMATEUR;
  if (!eligible || !utilisateur) return;

  const jeton = genererJetonOpaque();
  await prisma.jetonActionUtilisateur.create({
    data: {
      utilisateurId: utilisateur.id,
      type: TypeJetonAction.CONNEXION_FORMATEUR,
      tokenHash: hacherJeton(jeton),
      expiresAt: new Date(Date.now() + DUREE_JETON_MS),
    },
  });

  await envoyerLienMagiqueFormateur(utilisateur, `${origine}/organisateur/connexion/formateur/${jeton}`);
}

/**
 * Valide et consomme le jeton, retourne seulement l'utilisateurId — ne pose
 * PAS de session (cookies()) : la Server Action appelante crée la session
 * via creerSessionOrganisateur, pour rester testable sans contexte de
 * requête Next.js (même raison qu'auth.ts).
 */
export async function consommerLienMagique(jetonBrut: string): Promise<{ utilisateurId: string }> {
  const ligne = await prisma.jetonActionUtilisateur.findUnique({ where: { tokenHash: hacherJeton(jetonBrut) } });

  if (
    !ligne ||
    ligne.type !== TypeJetonAction.CONNEXION_FORMATEUR ||
    ligne.utiliseLe !== null ||
    ligne.expiresAt < new Date()
  ) {
    throw new JetonInvalideError();
  }

  await prisma.jetonActionUtilisateur.update({ where: { id: ligne.id }, data: { utiliseLe: new Date() } });

  return { utilisateurId: ligne.utilisateurId };
}
