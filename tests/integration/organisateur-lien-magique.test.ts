import argon2 from 'argon2';
import { afterAll, describe, expect, it } from 'vitest';
import { RoleUtilisateur, TypeJetonAction } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  JetonInvalideError,
  consommerLienMagique,
  demanderLienMagique,
} from '../../src/lib/organisateur/lien-magique-formateur';
import { hacherJeton } from '../../src/lib/organisateur/jeton-hash';

async function creerCabinet() {
  return prisma.cabinet.create({ data: { nom: 'Cabinet lien-magique-test' } });
}

describe('demanderLienMagique / consommerLienMagique', () => {
  it('crée un jeton valable 15 minutes pour un formateur existant', async () => {
    const cabinet = await creerCabinet();
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

    await demanderLienMagique(formateur.email, 'https://exemple.test');

    const ligne = await prisma.jetonActionUtilisateur.findFirstOrThrow({
      where: { utilisateurId: formateur.id, type: TypeJetonAction.CONNEXION_FORMATEUR },
    });
    expect(ligne.utiliseLe).toBeNull();
    expect(ligne.expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(ligne.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it("ne crée aucun jeton pour un organisateur (mot de passe, pas de lien magique)", async () => {
    const cabinet = await creerCabinet();
    const organisateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `organisateur.${Date.now()}@example.test`,
        nom: 'Test',
        prenom: 'Organisateur',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: await argon2.hash('MotDePasse!1'),
      },
    });

    await demanderLienMagique(organisateur.email, 'https://exemple.test');
    const lignes = await prisma.jetonActionUtilisateur.findMany({ where: { utilisateurId: organisateur.id } });
    expect(lignes).toEqual([]);
  });

  it('ne crée aucun jeton pour un email inconnu, sans lever d\'erreur', async () => {
    await expect(demanderLienMagique('personne@example.test', 'https://exemple.test')).resolves.toBeUndefined();
  });

  it('consomme le jeton une seule fois et retourne l\'utilisateurId du formateur', async () => {
    const cabinet = await creerCabinet();
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
    const jetonBrut = `jeton-magique-test-${Date.now()}-${Math.random()}`;
    await prisma.jetonActionUtilisateur.create({
      data: {
        utilisateurId: formateur.id,
        type: TypeJetonAction.CONNEXION_FORMATEUR,
        tokenHash: hacherJeton(jetonBrut),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const resultat = await consommerLienMagique(jetonBrut);
    expect(resultat.utilisateurId).toBe(formateur.id);

    await expect(consommerLienMagique(jetonBrut)).rejects.toThrow(JetonInvalideError);
  });

  it('un jeton expiré est refusé', async () => {
    const cabinet = await creerCabinet();
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
    const jetonBrut = `jeton-magique-expire-${Date.now()}-${Math.random()}`;
    await prisma.jetonActionUtilisateur.create({
      data: {
        utilisateurId: formateur.id,
        type: TypeJetonAction.CONNEXION_FORMATEUR,
        tokenHash: hacherJeton(jetonBrut),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(consommerLienMagique(jetonBrut)).rejects.toThrow(JetonInvalideError);
  });

  it('un jeton inconnu est refusé', async () => {
    await expect(consommerLienMagique('jamais-emis')).rejects.toThrow(JetonInvalideError);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
