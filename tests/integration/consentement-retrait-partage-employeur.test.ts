import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { traiterInscriptionPublique } from '../../src/lib/inscription-publique';
import { estConsentementActif, retirerConsentement } from '../../src/lib/consentement';

// Même cabinet pour les deux séminaires : le dédoublonnage participant est
// scopé par cabinetId (lot 1). Deux cabinets différents créeraient de toute
// façon deux participants distincts, ce qui ne testerait rien ici.
async function creerSeminaire(cabinetId: string, titre: string) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre,
      dateDebut: new Date('2027-04-01'),
      dateFin: new Date('2027-04-01'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });
}

describe('Retrait du consentement PARTAGE_EMPLOYEUR — scopé par formation', () => {
  it("retirer le partage pour l'employeur A n'affecte pas le consentement donné pour l'employeur B", async () => {
    const email = 'moussa.partage.employeur@example.test';
    const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test partage employeur' } });

    const seminaireA = await creerSeminaire(cabinet.id, 'Formation financée par employeur A');
    const resultatA = await traiterInscriptionPublique({
      seminaireId: seminaireA.id,
      nom: 'Fall',
      prenom: 'Moussa',
      email,
      telephone: null,
      fonction: null,
      organisation: null,
      ip: '203.0.113.40',
      userAgent: 'vitest',
      communicationsCoche: false,
      partageEmployeurCoche: true,
    });
    const inscriptionA = await prisma.inscription.findUniqueOrThrow({ where: { jeton: resultatA.jeton } });

    expect(await estConsentementActif(inscriptionA.participantId, 'PARTAGE_EMPLOYEUR', inscriptionA.id)).toBe(true);

    await retirerConsentement(inscriptionA.participantId, 'PARTAGE_EMPLOYEUR', inscriptionA.id);
    expect(await estConsentementActif(inscriptionA.participantId, 'PARTAGE_EMPLOYEUR', inscriptionA.id)).toBe(false);

    // Même participant (même email normalisé), autre séminaire = autre employeur.
    const seminaireB = await creerSeminaire(cabinet.id, 'Formation financée par employeur B');
    const resultatB = await traiterInscriptionPublique({
      seminaireId: seminaireB.id,
      nom: 'Fall',
      prenom: 'Moussa',
      email,
      telephone: null,
      fonction: null,
      organisation: null,
      ip: '203.0.113.41',
      userAgent: 'vitest',
      communicationsCoche: false,
      partageEmployeurCoche: true,
    });
    const inscriptionB = await prisma.inscription.findUniqueOrThrow({ where: { jeton: resultatB.jeton } });

    expect(inscriptionB.participantId).toBe(inscriptionA.participantId); // bien le même participant
    expect(await estConsentementActif(inscriptionB.participantId, 'PARTAGE_EMPLOYEUR', inscriptionB.id)).toBe(true);
    // Le retrait sur A reste sans effet sur A lui-même, bien sûr.
    expect(await estConsentementActif(inscriptionA.participantId, 'PARTAGE_EMPLOYEUR', inscriptionA.id)).toBe(false);
  });

  it('interroger PARTAGE_EMPLOYEUR sans inscriptionId est une erreur de programmation', async () => {
    await expect(estConsentementActif('un-id-quelconque', 'PARTAGE_EMPLOYEUR')).rejects.toThrow(
      /nécessite un inscriptionId/,
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
