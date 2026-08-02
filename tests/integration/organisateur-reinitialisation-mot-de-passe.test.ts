import argon2 from 'argon2';
import { afterAll, describe, expect, it } from 'vitest';
import { RoleUtilisateur, TypeJetonAction } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  JetonInvalideError,
  demanderReinitialisation,
  reinitialiserMotDePasse,
} from '../../src/lib/organisateur/reinitialisation-mot-de-passe';
import { hacherJeton } from '../../src/lib/organisateur/jeton-hash';

async function creerOrganisateur() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet reset-test' } });
  return prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email: `organisateur.${Date.now()}.${Math.random()}@example.test`,
      nom: 'Test',
      prenom: 'Reset',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash: await argon2.hash('AncienMotDePasse!1'),
    },
  });
}

describe('demanderReinitialisation / reinitialiserMotDePasse', () => {
  it('crée un jeton valable une heure pour un organisateur existant', async () => {
    const utilisateur = await creerOrganisateur();
    await demanderReinitialisation(utilisateur.email, 'https://exemple.test');

    const ligne = await prisma.jetonActionUtilisateur.findFirstOrThrow({
      where: { utilisateurId: utilisateur.id, type: TypeJetonAction.REINITIALISATION_MOT_DE_PASSE },
    });
    expect(ligne.utiliseLe).toBeNull();
    expect(ligne.expiresAt.getTime()).toBeGreaterThan(Date.now() + 55 * 60 * 1000);
    expect(ligne.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
  });

  it("ne crée aucun jeton pour un email inconnu, sans lever d'erreur", async () => {
    await expect(demanderReinitialisation('personne@example.test', 'https://exemple.test')).resolves.toBeUndefined();
  });

  it('ne crée aucun jeton pour un formateur (pas de mot de passe à réinitialiser)', async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet reset-formateur' } });
    const formateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `formateur.${Date.now()}@example.test`,
        nom: 'Test',
        prenom: 'Formateur',
        role: RoleUtilisateur.FORMATEUR,
        motDePasseHash: null,
      },
    });
    await demanderReinitialisation(formateur.email, 'https://exemple.test');
    const lignes = await prisma.jetonActionUtilisateur.findMany({ where: { utilisateurId: formateur.id } });
    expect(lignes).toEqual([]);
  });

  it('change le mot de passe, invalide le jeton (usage unique), et détruit les sessions ouvertes', async () => {
    const utilisateur = await creerOrganisateur();

    // creerSessionOrganisateur (lib/organisateur/session.ts) dépend de
    // next/headers, indisponible hors d'une requête Next.js — on crée donc
    // directement la ligne ici pour tester la destruction des sessions par
    // reinitialiserMotDePasse, sans passer par cookies().
    await prisma.sessionOrganisateur.create({
      data: { utilisateurId: utilisateur.id, tokenHash: hacherJeton(`jeton-de-session-test-${Date.now()}-${Math.random()}`), expiresAt: new Date(Date.now() + 3600_000) },
    });

    // On simule le jeton reçu par email : même construction que le lib (hash
    // sha256), en passant directement par un jeton en clair connu du test.
    const jetonBrut = `jeton-en-clair-de-test-${Date.now()}-${Math.random()}`;
    await prisma.jetonActionUtilisateur.create({
      data: {
        utilisateurId: utilisateur.id,
        type: TypeJetonAction.REINITIALISATION_MOT_DE_PASSE,
        tokenHash: hacherJeton(jetonBrut),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    await reinitialiserMotDePasse(jetonBrut, 'NouveauMotDePasse!2');

    const misAJour = await prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateur.id } });
    expect(await argon2.verify(misAJour.motDePasseHash!, 'NouveauMotDePasse!2')).toBe(true);

    const sessionsRestantes = await prisma.sessionOrganisateur.count({ where: { utilisateurId: utilisateur.id } });
    expect(sessionsRestantes).toBe(0);

    // Le même jeton ne peut pas resservir.
    await expect(reinitialiserMotDePasse(jetonBrut, 'EncoreUnAutre!3')).rejects.toThrow(JetonInvalideError);
  });

  it('un jeton expiré est refusé', async () => {
    const utilisateur = await creerOrganisateur();
    const jetonBrut = `jeton-expire-de-test-${Date.now()}-${Math.random()}`;
    await prisma.jetonActionUtilisateur.create({
      data: {
        utilisateurId: utilisateur.id,
        type: TypeJetonAction.REINITIALISATION_MOT_DE_PASSE,
        tokenHash: hacherJeton(jetonBrut),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(reinitialiserMotDePasse(jetonBrut, 'NouveauMotDePasse!4')).rejects.toThrow(JetonInvalideError);
  });

  it('un jeton inconnu est refusé', async () => {
    await expect(reinitialiserMotDePasse('jeton-jamais-emis', 'NouveauMotDePasse!5')).rejects.toThrow(
      JetonInvalideError,
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
