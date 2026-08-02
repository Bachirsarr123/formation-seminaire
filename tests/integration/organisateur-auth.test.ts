import argon2 from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RoleUtilisateur } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  ConnexionTemporiseeError,
  IdentifiantsInvalidesError,
  connecterOrganisateur,
  verifierIdentifiants,
} from '../../src/lib/organisateur/auth';

const MOT_DE_PASSE_REEL = 'UnMotDePasseSolide!2026';
let cabinetId: string;
let emailOrganisateur: string;

beforeAll(async () => {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet auth-test' } });
  cabinetId = cabinet.id;
  emailOrganisateur = `organisatrice.${Date.now()}@example.test`;

  await prisma.utilisateur.create({
    data: {
      cabinetId,
      email: emailOrganisateur,
      nom: 'Test',
      prenom: 'Organisatrice',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash: await argon2.hash(MOT_DE_PASSE_REEL),
    },
  });
});

describe('connecterOrganisateur — identifiants et verrouillage', () => {
  it('un mot de passe correct authentifie', async () => {
    const { utilisateurId } = await connecterOrganisateur({
      email: emailOrganisateur,
      motDePasse: MOT_DE_PASSE_REEL,
      ip: '10.0.1.1',
    });
    expect(utilisateurId).toBeTruthy();
  });

  it('un mot de passe incorrect est rejeté (IdentifiantsInvalidesError)', async () => {
    await expect(
      connecterOrganisateur({ email: emailOrganisateur, motDePasse: 'faux', ip: '10.0.1.2' }),
    ).rejects.toThrow(IdentifiantsInvalidesError);
  });

  it('un email inconnu est rejeté avec exactement le même type d\'erreur (jamais de distinction)', async () => {
    await expect(
      connecterOrganisateur({ email: 'personne@example.test', motDePasse: 'peu importe', ip: '10.0.1.3' }),
    ).rejects.toThrow(IdentifiantsInvalidesError);
  });

  it('un formateur sans mot de passe ne peut jamais se connecter par ce chemin', async () => {
    const formateur = await prisma.utilisateur.create({
      data: {
        cabinetId,
        email: `formateur.${Date.now()}@example.test`,
        nom: 'Test',
        prenom: 'Formateur',
        role: RoleUtilisateur.FORMATEUR,
        motDePasseHash: null,
      },
    });
    await expect(
      connecterOrganisateur({ email: formateur.email, motDePasse: 'peu importe', ip: '10.0.1.4' }),
    ).rejects.toThrow(IdentifiantsInvalidesError);
  });

  it('6 échecs consécutifs (email, IP) déclenchent la temporisation', async () => {
    const email = `verrou.${Date.now()}@example.test`;
    await prisma.utilisateur.create({
      data: {
        cabinetId,
        email,
        nom: 'Test',
        prenom: 'Verrou',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: await argon2.hash(MOT_DE_PASSE_REEL),
      },
    });
    const ip = '10.0.2.1';

    for (let i = 0; i < 5; i++) {
      await expect(connecterOrganisateur({ email, motDePasse: 'faux', ip })).rejects.toThrow(
        IdentifiantsInvalidesError,
      );
    }

    // 6e tentative : le verrou doit avoir pris le relais, y compris si le mot
    // de passe est cette fois le bon — le verrou bloque l'accès, point.
    await expect(connecterOrganisateur({ email, motDePasse: MOT_DE_PASSE_REEL, ip })).rejects.toThrow(
      ConnexionTemporiseeError,
    );
  });

  it("le verrou est scopé au couple (email, IP) : une autre IP n'est jamais bloquée par les échecs d'une IP tierce", async () => {
    const email = `partage.${Date.now()}@example.test`;
    await prisma.utilisateur.create({
      data: {
        cabinetId,
        email,
        nom: 'Test',
        prenom: 'Partagee',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: await argon2.hash(MOT_DE_PASSE_REEL),
      },
    });
    const ipAttaquant = '10.0.3.1';
    const ipTitulaire = '10.0.3.2';

    for (let i = 0; i < 6; i++) {
      await connecterOrganisateur({ email, motDePasse: 'faux', ip: ipAttaquant }).catch(() => undefined);
    }

    // L'IP de l'attaquant est bien verrouillée...
    await expect(
      connecterOrganisateur({ email, motDePasse: MOT_DE_PASSE_REEL, ip: ipAttaquant }),
    ).rejects.toThrow(ConnexionTemporiseeError);

    // ...mais le titulaire, depuis SA propre IP, se connecte normalement : un
    // tiers qui connaît l'adresse ne peut pas bloquer le compte pour tout le monde.
    const { utilisateurId } = await connecterOrganisateur({
      email,
      motDePasse: MOT_DE_PASSE_REEL,
      ip: ipTitulaire,
    });
    expect(utilisateurId).toBeTruthy();
  });

  it('une connexion réussie réinitialise le compteur pour ce couple (email, IP)', async () => {
    const email = `reset.${Date.now()}@example.test`;
    await prisma.utilisateur.create({
      data: {
        cabinetId,
        email,
        nom: 'Test',
        prenom: 'Reset',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: await argon2.hash(MOT_DE_PASSE_REEL),
      },
    });
    const ip = '10.0.4.1';

    for (let i = 0; i < 3; i++) {
      await connecterOrganisateur({ email, motDePasse: 'faux', ip }).catch(() => undefined);
    }
    await connecterOrganisateur({ email, motDePasse: MOT_DE_PASSE_REEL, ip });

    // Trois nouveaux échecs après le succès : encore loin du seuil de 5.
    for (let i = 0; i < 3; i++) {
      await expect(connecterOrganisateur({ email, motDePasse: 'faux', ip })).rejects.toThrow(
        IdentifiantsInvalidesError,
      );
    }
  });

  it('le temps de réponse est du même ordre pour un email inconnu et un mot de passe erroné', async () => {
    const mesurer = async (email: string) => {
      const debut = performance.now();
      await verifierIdentifiants(email, 'mot-de-passe-quelconque');
      return performance.now() - debut;
    };

    // Chauffe (première invocation argon2 parfois plus lente).
    await mesurer(emailOrganisateur);

    const dureesInconnu: number[] = [];
    const dureesConnu: number[] = [];
    for (let i = 0; i < 3; i++) {
      dureesInconnu.push(await mesurer(`inconnu-${i}-${Date.now()}@example.test`));
      dureesConnu.push(await mesurer(emailOrganisateur));
    }

    const mediane = (valeurs: number[]) => valeurs.slice().sort((a, b) => a - b)[Math.floor(valeurs.length / 2)]!;
    const ecart = Math.abs(mediane(dureesInconnu) - mediane(dureesConnu));

    // Tolérance généreuse (charge de la machine de test) : ce qui compte est
    // qu'aucun chemin ne court-circuite l'argon2.verify, pas une précision
    // à la milliseconde près.
    expect(ecart).toBeLessThan(200);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
