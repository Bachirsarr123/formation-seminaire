import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { listerSeminaires } from '../../src/lib/organisateur/seminaires';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinet() {
  return prisma.cabinet.create({ data: { nom: `Cabinet liste-test ${Date.now()}` } });
}

async function creerSeminaire(cabinetId: string, donnees: {
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  statut?: StatutSeminaire;
  capaciteMax?: number;
}) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: donnees.titre,
      dateDebut: donnees.dateDebut,
      dateFin: donnees.dateFin,
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: donnees.statut ?? StatutSeminaire.PUBLIE,
      capaciteMax: donnees.capaciteMax,
    },
  });
}

describe('listerSeminaires — filtres, tri, pagination', () => {
  it('trie les séminaires à venir en premier (date croissante), puis les passés (date croissante)', async () => {
    const cabinet = await creerCabinet();
    const dansDeuxMois = await creerSeminaire(cabinet.id, {
      titre: 'Dans deux mois',
      dateDebut: new Date(Date.now() + 60 * 86_400_000),
      dateFin: new Date(Date.now() + 60 * 86_400_000 + 8 * 3_600_000),
    });
    const dansUnMois = await creerSeminaire(cabinet.id, {
      titre: 'Dans un mois',
      dateDebut: new Date(Date.now() + 30 * 86_400_000),
      dateFin: new Date(Date.now() + 30 * 86_400_000 + 8 * 3_600_000),
    });
    const ilYaDeuxMois = await creerSeminaire(cabinet.id, {
      titre: 'Il y a deux mois',
      dateDebut: new Date(Date.now() - 60 * 86_400_000),
      dateFin: new Date(Date.now() - 60 * 86_400_000 + 8 * 3_600_000),
    });
    const ilYaUnMois = await creerSeminaire(cabinet.id, {
      titre: 'Il y a un mois',
      dateDebut: new Date(Date.now() - 30 * 86_400_000),
      dateFin: new Date(Date.now() - 30 * 86_400_000 + 8 * 3_600_000),
    });

    const { items } = await listerSeminaires(cabinet.id, {}, { page: 1 });

    expect(items.map((s) => s.id)).toEqual([dansUnMois.id, dansDeuxMois.id, ilYaUnMois.id, ilYaDeuxMois.id]);
  });

  it('filtre par statut', async () => {
    const cabinet = await creerCabinet();
    const brouillon = await creerSeminaire(cabinet.id, {
      titre: 'Brouillon',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
      statut: StatutSeminaire.BROUILLON,
    });
    const publie = await creerSeminaire(cabinet.id, {
      titre: 'Publié',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
      statut: StatutSeminaire.PUBLIE,
    });

    const { items } = await listerSeminaires(cabinet.id, { statut: StatutSeminaire.PUBLIE }, { page: 1 });

    expect(items.map((s) => s.id)).toEqual([publie.id]);
    expect(items.map((s) => s.id)).not.toContain(brouillon.id);
  });

  it('recherche par titre (insensible à la casse)', async () => {
    const cabinet = await creerCabinet();
    const cible = await creerSeminaire(cabinet.id, {
      titre: 'Atelier Gouvernance Associative',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
    });
    await creerSeminaire(cabinet.id, {
      titre: 'Autre chose',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
    });

    const { items } = await listerSeminaires(cabinet.id, { recherche: 'gouvernance' }, { page: 1 });

    expect(items.map((s) => s.id)).toEqual([cible.id]);
  });

  it('exclut les séminaires supprimés logiquement', async () => {
    const cabinet = await creerCabinet();
    const supprime = await creerSeminaire(cabinet.id, {
      titre: 'Supprimé',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
    });
    await prisma.seminaire.update({ where: { id: supprime.id }, data: { supprimeLe: new Date() } });

    const { items } = await listerSeminaires(cabinet.id, {}, { page: 1 });

    expect(items.map((s) => s.id)).not.toContain(supprime.id);
  });

  it('pagine correctement (total exact, page bornée)', async () => {
    const cabinet = await creerCabinet();
    for (let i = 0; i < 5; i++) {
      await creerSeminaire(cabinet.id, {
        titre: `Séminaire ${i}`,
        dateDebut: new Date(Date.now() + i * 86_400_000),
        dateFin: new Date(Date.now() + i * 86_400_000 + 3_600_000),
      });
    }

    const page1 = await listerSeminaires(cabinet.id, {}, { page: 1, parPage: 2 });
    const page2 = await listerSeminaires(cabinet.id, {}, { page: 2, parPage: 2 });

    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.items.map((s) => s.id)).not.toEqual(page2.items.map((s) => s.id));
  });

  it("calcule le taux de réponse à partir des inscrits confirmés uniquement, et renvoie null sans confirmé", async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, {
      titre: 'Avec réponses',
      dateDebut: new Date(Date.now() - 86_400_000),
      dateFin: new Date(Date.now() - 86_400_000 + 3_600_000),
      capaciteMax: 10,
    });
    const participant1 = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'A', prenom: 'A', email: 'a.taux@example.test' },
    });
    const participant2 = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'B', prenom: 'B', email: 'b.taux@example.test' },
    });
    await prisma.inscription.create({
      data: {
        seminaireId: seminaire.id,
        participantId: participant1.id,
        jeton: genererCodePublicSeminaire() + genererCodePublicSeminaire(),
        statut: 'CONFIRMEE',
        source: 'MANUEL',
        aRepondu: true,
      },
    });
    await prisma.inscription.create({
      data: {
        seminaireId: seminaire.id,
        participantId: participant2.id,
        jeton: genererCodePublicSeminaire() + genererCodePublicSeminaire(),
        statut: 'CONFIRMEE',
        source: 'MANUEL',
        aRepondu: false,
      },
    });

    const { items } = await listerSeminaires(cabinet.id, {}, { page: 1 });
    const ligne = items.find((s) => s.id === seminaire.id)!;
    expect(ligne.inscrits).toBe(2);
    expect(ligne.tauxReponse).toBe(0.5);

    const cabinetVide = await creerCabinet();
    const seminaireVide = await creerSeminaire(cabinetVide.id, {
      titre: 'Sans personne',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 3_600_000),
    });
    const { items: itemsVide } = await listerSeminaires(cabinetVide.id, {}, { page: 1 });
    expect(itemsVide.find((s) => s.id === seminaireVide.id)!.tauxReponse).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
