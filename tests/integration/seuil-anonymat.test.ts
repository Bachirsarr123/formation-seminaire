import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { listerMessagesAnonymes } from '../../src/lib/anonymat';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerSeminaire() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test anonymat' } });

  return prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire anonymat',
      dateDebut: new Date('2026-11-01'),
      dateFin: new Date('2026-11-01'),
      modalite: Modalite.HYBRIDE,
      dureeHeures: 4,
      statut: StatutSeminaire.PUBLIE,
      seuilAnonymat: 5,
    },
  });
}

// Préfixé par seminaireId (uuid généré à chaque création) : `codeSuiviHash`
// est désormais unique en base, un littéral partagé entre deux séminaires
// (ou deux exécutions successives de la suite) violerait la contrainte.
async function ajouterMessages(seminaireId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await prisma.messageAnonyme.create({
      data: {
        seminaireId,
        contenu: `Message ${i + 1}`,
        codeSuiviHash: `${seminaireId}-hash-${i + 1}`,
      },
    });
  }
}

describe('Seuil d\'anonymat des messages (AC6)', () => {
  it('avec 4 messages sur un seuil de 5, l\'organisateur n\'en voit aucun mais connaît le total', async () => {
    const seminaire = await creerSeminaire();
    await ajouterMessages(seminaire.id, 4);

    const resultat = await listerMessagesAnonymes(seminaire.id, seminaire.seuilAnonymat);

    expect(resultat.visible).toBe(false);
    expect(resultat.total).toBe(4);
    expect(resultat.messages).toEqual([]);
  });

  it('au 5e message, l\'organisateur voit les 5, dans un ordre non chronologique', async () => {
    const seminaire = await creerSeminaire();
    await ajouterMessages(seminaire.id, 5);

    const resultat = await listerMessagesAnonymes(seminaire.id, seminaire.seuilAnonymat);

    expect(resultat.visible).toBe(true);
    expect(resultat.total).toBe(5);
    expect(resultat.messages).toHaveLength(5);

    const contenus = resultat.messages.map((m) => m.contenu).sort();
    expect(contenus).toEqual(['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5']);

    // L'ordre renvoyé ne doit pas être garanti égal à l'ordre chronologique
    // d'insertion. Un mélange aléatoire peut, par chance, retomber sur le
    // même ordre — on relance donc le mélange plusieurs fois et on exige
    // qu'au moins une itération diffère de l'ordre d'insertion.
    const ordreInsertion = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
    const tentatives = await Promise.all(
      Array.from({ length: 20 }, () => listerMessagesAnonymes(seminaire.id, seminaire.seuilAnonymat)),
    );
    const auMoinsUnOrdreDifferent = tentatives.some(
      (t) => t.messages.map((m) => m.contenu).join(',') !== ordreInsertion.join(','),
    );
    expect(auMoinsUnOrdreDifferent).toBe(true);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
