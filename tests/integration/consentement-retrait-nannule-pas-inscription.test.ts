import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { traiterInscriptionPublique } from '../../src/lib/inscription-publique';
import { retirerConsentement } from '../../src/lib/consentement';

async function inscrireAvecTousLesConsentements() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test retrait n\'annule rien' } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire test retrait n\'annule rien',
      dateDebut: new Date('2027-05-01'),
      dateFin: new Date('2027-05-01'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });

  const resultat = await traiterInscriptionPublique({
    seminaireId: seminaire.id,
    nom: 'Kane',
    prenom: 'Ousmane',
    email: 'ousmane.kane.retrait@example.test',
    telephone: null,
    fonction: null,
    organisation: null,
    ip: '203.0.113.50',
    userAgent: 'vitest',
    communicationsCoche: true,
    partageEmployeurCoche: true,
  });

  return prisma.inscription.findUniqueOrThrow({ where: { jeton: resultat.jeton } });
}

describe("Retirer un consentement (quelle que soit la finalité) n'annule pas l'inscription", () => {
  it('COMMUNICATIONS et PARTAGE_EMPLOYEUR : statut, aRepondu et aReponduLe restent inchangés après retrait', async () => {
    const inscriptionAvant = await inscrireAvecTousLesConsentements();

    await retirerConsentement(inscriptionAvant.participantId, 'COMMUNICATIONS');
    await retirerConsentement(inscriptionAvant.participantId, 'PARTAGE_EMPLOYEUR', inscriptionAvant.id);

    const inscriptionApres = await prisma.inscription.findUniqueOrThrow({ where: { id: inscriptionAvant.id } });

    expect(inscriptionApres.statut).toBe(inscriptionAvant.statut);
    expect(inscriptionApres.aRepondu).toBe(inscriptionAvant.aRepondu);
    expect(inscriptionApres.aReponduLe).toEqual(inscriptionAvant.aReponduLe);
    expect(inscriptionApres.jeton).toBe(inscriptionAvant.jeton);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
