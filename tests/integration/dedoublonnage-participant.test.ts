import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { traiterInscriptionPublique } from '../../src/lib/inscription-publique';

async function creerSeminaireOuvert() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test dédoublonnage' } });
  return prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire test dédoublonnage',
      dateDebut: new Date('2027-02-05'),
      dateFin: new Date('2027-02-05'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });
}

describe('Dédoublonnage participant (normalisation avant recherche)', () => {
  it('Awa.Diop@X.SN puis awa.diop@x.sn  → un seul participant, une seule inscription', async () => {
    const seminaire = await creerSeminaireOuvert();

    const premiere = await traiterInscriptionPublique({
      seminaireId: seminaire.id,
      nom: 'Diop',
      prenom: '  Awa ',
      email: 'Awa.Diop@X.SN',
      telephone: null,
      fonction: null,
      organisation: null,
      ip: '203.0.113.20',
      userAgent: 'vitest',
      communicationsCoche: false,
      partageEmployeurCoche: false,
    });

    const seconde = await traiterInscriptionPublique({
      seminaireId: seminaire.id,
      nom: 'Diop',
      prenom: 'Awa',
      // Casse différente + espace multiple superflu en fin de chaîne dans
      // l'énoncé d'origine — la normalisation doit gommer les deux.
      email: 'awa.diop@x.sn ',
      telephone: null,
      fonction: null,
      organisation: null,
      ip: '203.0.113.21',
      userAgent: 'vitest',
      communicationsCoche: false,
      partageEmployeurCoche: false,
    });

    expect(seconde.situation).toBe('dejaActive');
    expect(seconde.jeton).toBe(premiere.jeton);

    const participants = await prisma.participant.count({
      where: { cabinetId: seminaire.cabinetId, email: 'awa.diop@x.sn' },
    });
    expect(participants).toBe(1);

    const inscriptions = await prisma.inscription.count({ where: { seminaireId: seminaire.id } });
    expect(inscriptions).toBe(1);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
