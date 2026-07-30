import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { SeminaireCompletError, traiterInscriptionPublique } from '../../src/lib/inscription-publique';

async function creerSeminaireComplet(capaciteMax: number) {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test jauge' } });
  return prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Formation places limitées — test concurrence',
      dateDebut: new Date('2027-01-10'),
      dateFin: new Date('2027-01-10'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
      capaciteMax,
    },
  });
}

function inscriptionType(seminaireId: string, suffixe: string) {
  return {
    seminaireId,
    nom: 'Diallo',
    prenom: `Testeur${suffixe}`,
    email: `testeur.jauge.${suffixe}@example.test`,
    telephone: null,
    fonction: null,
    organisation: null,
    ip: '203.0.113.10',
    userAgent: 'vitest',
    communicationsCoche: false,
    partageEmployeurCoche: false,
  };
}

describe('Jauge de places — verrou transactionnel sous concurrence', () => {
  it('deux inscriptions concurrentes sur la dernière place : une seule réussit', async () => {
    const seminaire = await creerSeminaireComplet(1);

    // La concurrence est créée ICI, à l'intérieur du test : les deux appels
    // sont lancés sans `await` intermédiaire, donc démarrent réellement en
    // parallèle (chacun via une connexion distincte du pool Prisma) et se
    // disputent le même verrou `FOR UPDATE` sur la ligne séminaire. Ce test
    // ne dépend d'aucun autre fichier ni du parallélisme entre fichiers —
    // il reste valide même avec `fileParallelism: false` (vitest.config.ts).
    const [resultatA, resultatB] = await Promise.allSettled([
      traiterInscriptionPublique(inscriptionType(seminaire.id, 'a')),
      traiterInscriptionPublique(inscriptionType(seminaire.id, 'b')),
    ]);

    const reussites = [resultatA, resultatB].filter((r) => r.status === 'fulfilled');
    const echecs = [resultatA, resultatB].filter((r) => r.status === 'rejected');

    expect(reussites).toHaveLength(1);
    expect(echecs).toHaveLength(1);
    expect((echecs[0] as PromiseRejectedResult).reason).toBeInstanceOf(SeminaireCompletError);

    const inscriptionsConfirmees = await prisma.inscription.count({
      where: { seminaireId: seminaire.id, statut: { in: ['CONFIRMEE', 'EN_ATTENTE'] } },
    });
    expect(inscriptionsConfirmees).toBe(1);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
