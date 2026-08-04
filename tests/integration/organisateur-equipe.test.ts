import { afterAll, describe, expect, it } from 'vitest';
import { RoleUtilisateur } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  AutoDesactivationError,
  EmailDejaUtiliseError,
  creerFormateur,
  desactiverCompte,
  listerEquipe,
} from '../../src/lib/organisateur/equipe';

/**
 * Lot 4, étape 9 (gestion des comptes du cabinet). Même règle B que
 * seminaires.ts/participants.ts : cabinetId obligatoire, appliqué en clause
 * WHERE — voir aussi le pointeur dans organisateur-isolation.test.ts
 * (checklist étape 8, tenue à jour).
 */

async function creerCabinet(nom: string) {
  return prisma.cabinet.create({ data: { nom } });
}

describe('creerFormateur', () => {
  it('crée un compte FORMATEUR sans mot de passe, actif par défaut', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — création');

    const formateur = await creerFormateur(cabinet.id, {
      nom: 'Camara',
      prenom: 'Issa',
      email: `issa.${Date.now()}@example.test`,
    });

    expect(formateur.role).toBe(RoleUtilisateur.FORMATEUR);
    expect(formateur.motDePasseHash).toBeNull();
    expect(formateur.actif).toBe(true);
    expect(formateur.cabinetId).toBe(cabinet.id);
  });

  it("refuse un e-mail déjà utilisé par un compte du MÊME cabinet, avec une erreur dédiée", async () => {
    const cabinet = await creerCabinet('Cabinet équipe — doublon même cabinet');
    const email = `doublon.${Date.now()}@example.test`;
    await creerFormateur(cabinet.id, { nom: 'Fall', prenom: 'A', email });

    await expect(creerFormateur(cabinet.id, { nom: 'Fall', prenom: 'B', email })).rejects.toThrow(
      EmailDejaUtiliseError,
    );
  });

  it("refuse un e-mail déjà utilisé par un compte d'un AUTRE cabinet — l'unicité est globale (schema.prisma)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — doublon cross A');
    const cabinetB = await creerCabinet('Cabinet équipe — doublon cross B');
    const email = `cross-cabinet.${Date.now()}@example.test`;
    await creerFormateur(cabinetA.id, { nom: 'Ndiaye', prenom: 'A', email });

    await expect(creerFormateur(cabinetB.id, { nom: 'Ndiaye', prenom: 'B', email })).rejects.toThrow(
      EmailDejaUtiliseError,
    );
  });
});

describe('listerEquipe', () => {
  it('ne retourne jamais un membre d\'un autre cabinet, et inclut actifs et désactivés', async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — liste A');
    const cabinetB = await creerCabinet('Cabinet équipe — liste B');

    const membreA = await creerFormateur(cabinetA.id, { nom: 'Sarr', prenom: 'A', email: `liste.a.${Date.now()}@example.test` });
    const membreB = await creerFormateur(cabinetB.id, { nom: 'Sarr', prenom: 'B', email: `liste.b.${Date.now()}@example.test` });
    await desactiverCompte(cabinetA.id, membreA.id, 'quelqu-un-d-autre');

    const listeA = await listerEquipe(cabinetA.id);

    expect(listeA.map((m) => m.id)).toContain(membreA.id);
    expect(listeA.map((m) => m.id)).not.toContain(membreB.id);
    expect(listeA.find((m) => m.id === membreA.id)?.actif).toBe(false);
  });
});

describe('desactiverCompte', () => {
  it('pose actif=false et ne supprime jamais la ligne', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — désactivation');
    const formateur = await creerFormateur(cabinet.id, { nom: 'Ba', prenom: 'C', email: `desact.${Date.now()}@example.test` });

    const resultat = await desactiverCompte(cabinet.id, formateur.id, 'un-autre-utilisateur');

    expect(resultat).toBe(true);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateur.id } });
    expect(relu.actif).toBe(false);
  });

  it("ne désactive jamais un compte d'un autre cabinet (isolation)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — isolation A');
    const cabinetB = await creerCabinet('Cabinet équipe — isolation B');
    const formateurB = await creerFormateur(cabinetB.id, { nom: 'Diallo', prenom: 'D', email: `isolation.${Date.now()}@example.test` });

    const resultat = await desactiverCompte(cabinetA.id, formateurB.id, 'un-autre-utilisateur');

    expect(resultat).toBe(false);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateurB.id } });
    expect(relu.actif).toBe(true);
  });

  it('refuse qu\'un compte se désactive lui-même', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — auto-désactivation');
    const organisateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `auto.${Date.now()}@example.test`,
        nom: 'Ndiaye',
        prenom: 'Awa',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: 'x',
      },
    });

    await expect(desactiverCompte(cabinet.id, organisateur.id, organisateur.id)).rejects.toThrow(
      AutoDesactivationError,
    );
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: organisateur.id } });
    expect(relu.actif).toBe(true);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
