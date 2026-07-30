import { afterAll, describe, expect, it } from 'vitest';
import {
  Modalite,
  Prisma,
  SourceInscription,
  StatutSeminaire,
} from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire, genererJetonInscription } from '../../src/lib/jeton';

/**
 * `consentement` est une table en ajout seul (cf. schema.prisma) : deux
 * triggers Postgres (migration 20260730124642_ajout_consentement, hors DSL
 * Prisma) l'imposent indépendamment de tout code applicatif — ces tests
 * vérifient la base réellement migrée, pas une relecture du SQL.
 */

async function creerParticipantEtInscription() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test consentement' } });
  const participant = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Sy', prenom: 'Aminata', email: 'aminata.sy@example.test' },
  });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire test consentement',
      dateDebut: new Date('2026-11-01'),
      dateFin: new Date('2026-11-01'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
    },
  });
  const inscription = await prisma.inscription.create({
    data: {
      seminaireId: seminaire.id,
      participantId: participant.id,
      jeton: genererJetonInscription(),
      source: SourceInscription.MANUEL,
    },
  });
  return { cabinet, participant, seminaire, inscription };
}

describe('Consentement — table en ajout seul (triggers Postgres)', () => {
  it('un UPDATE sur une colonne autre que retire_le est refusé', async () => {
    const { participant, inscription } = await creerParticipantEtInscription();
    const c = await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription.id,
        finalite: 'COMMUNICATIONS',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    await expect(
      prisma.consentement.update({ where: { id: c.id }, data: { versionTexte: 'v2.0-2027-01' } }),
    ).rejects.toThrow(/seule retire_le est modifiable/);
  });

  it('retire_le ne peut être posé qu\'une seule fois', async () => {
    const { participant, inscription } = await creerParticipantEtInscription();
    const c = await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription.id,
        finalite: 'COMMUNICATIONS',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    await prisma.consentement.update({ where: { id: c.id }, data: { retireLe: new Date() } });

    await expect(
      prisma.consentement.update({ where: { id: c.id }, data: { retireLe: new Date('2030-01-01') } }),
    ).rejects.toThrow(/seule retire_le est modifiable/);
  });

  it('INSCRIPTION_EVALUATION ne peut pas être retiré, y compris en contournant le lib (SQL brut)', async () => {
    const { participant, inscription } = await creerParticipantEtInscription();
    const c = await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription.id,
        finalite: 'INSCRIPTION_EVALUATION',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    await expect(
      prisma.$executeRaw`UPDATE consentement SET retire_le = now() WHERE id = ${c.id}`,
    ).rejects.toThrow(/INSCRIPTION_EVALUATION n'est pas retirable/);
  });

  it('un DELETE est toujours refusé', async () => {
    const { participant, inscription } = await creerParticipantEtInscription();
    const c = await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription.id,
        finalite: 'COMMUNICATIONS',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    await expect(prisma.consentement.delete({ where: { id: c.id } })).rejects.toThrow(
      /suppression interdite/,
    );
  });

  it('une seule ligne active par (participant, finalité) pour COMMUNICATIONS — portée globale', async () => {
    const { participant, inscription } = await creerParticipantEtInscription();
    await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription.id,
        finalite: 'COMMUNICATIONS',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    await expect(
      prisma.consentement.create({
        data: {
          participantId: participant.id,
          inscriptionId: inscription.id,
          finalite: 'COMMUNICATIONS',
          versionTexte: 'v1.0-2026-07',
          donneLe: new Date(),
          preuveHash: 'hash-test',
        },
      }),
    ).rejects.toThrow();
  });

  it('PARTAGE_EMPLOYEUR : deux inscriptions différentes du même participant peuvent chacune avoir une ligne active', async () => {
    const { cabinet, participant, seminaire } = await creerParticipantEtInscription();
    const inscription1 = await prisma.inscription.findFirstOrThrow({
      where: { participantId: participant.id, seminaireId: seminaire.id },
    });
    const seminaire2 = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Deuxième séminaire (employeur B)',
        dateDebut: new Date('2026-12-01'),
        dateFin: new Date('2026-12-01'),
        modalite: Modalite.DISTANCIEL,
        dureeHeures: 3,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    const inscription2 = await prisma.inscription.create({
      data: {
        seminaireId: seminaire2.id,
        participantId: participant.id,
        jeton: genererJetonInscription(),
        source: SourceInscription.MANUEL,
      },
    });

    await prisma.consentement.create({
      data: {
        participantId: participant.id,
        inscriptionId: inscription1.id,
        finalite: 'PARTAGE_EMPLOYEUR',
        versionTexte: 'v1.0-2026-07',
        donneLe: new Date(),
        preuveHash: 'hash-test',
      },
    });

    // Ne doit PAS échouer : inscription différente, donc couple différent.
    await expect(
      prisma.consentement.create({
        data: {
          participantId: participant.id,
          inscriptionId: inscription2.id,
          finalite: 'PARTAGE_EMPLOYEUR',
          versionTexte: 'v1.0-2026-07',
          donneLe: new Date(),
          preuveHash: 'hash-test',
        },
      }),
    ).resolves.toBeDefined();

    // Une deuxième ligne active pour la MÊME inscription doit, elle, échouer.
    await expect(
      prisma.consentement.create({
        data: {
          participantId: participant.id,
          inscriptionId: inscription1.id,
          finalite: 'PARTAGE_EMPLOYEUR',
          versionTexte: 'v1.0-2026-07',
          donneLe: new Date(),
          preuveHash: 'hash-test',
        },
      }),
    ).rejects.toThrow();
  });

  it('PARTAGE_EMPLOYEUR sans inscriptionId viole la contrainte CHECK', async () => {
    const { participant } = await creerParticipantEtInscription();

    await expect(
      prisma.consentement.create({
        data: {
          participantId: participant.id,
          finalite: 'PARTAGE_EMPLOYEUR',
          versionTexte: 'v1.0-2026-07',
          donneLe: new Date(),
          preuveHash: 'hash-test',
        },
      }),
    ).rejects.toThrow();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
