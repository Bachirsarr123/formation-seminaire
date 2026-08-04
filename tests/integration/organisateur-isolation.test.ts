import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { dupliquerSeminaire, listerSeminaires, obtenirSeminaire } from '../../src/lib/organisateur/seminaires';
import {
  genererFluxIcsCabinet,
  listerSeminairesAgenda,
  obtenirOuGenererJetonFluxIcs,
  resoudreCabinetParJetonFluxIcs,
} from '../../src/lib/organisateur/agenda';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

/**
 * Règle B du lot 4 (la plus importante) : toute fonction de lib/organisateur/
 * prend le cabinetId en paramètre obligatoire et l'applique en clause WHERE —
 * jamais une ressource d'un autre cabinet, même en devinant/énumérant un id.
 *
 * Ce fichier grossit d'un cas par étape à mesure que de nouvelles routes
 * cabinet-scopées apparaissent (étapes 5, 6, 7) — voir le découpage du lot.
 * Le premier vrai cas « 404 (jamais 403) sur une ressource d'un autre
 * cabinet » viendra avec la fiche séminaire (étape 5, qui prend un id en
 * URL) ; ici, on vérifie l'étanchéité des fonctions de liste/agenda/ICS
 * elles-mêmes.
 */

async function creerCabinetAvecSeminaire(nomCabinet: string, titreSeminaire: string) {
  const cabinet = await prisma.cabinet.create({ data: { nom: nomCabinet } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: titreSeminaire,
      dateDebut: new Date('2026-09-01T09:00:00Z'),
      dateFin: new Date('2026-09-01T17:00:00Z'),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });
  return { cabinet, seminaire };
}

describe('Isolation par cabinet — lib/organisateur/', () => {
  it("listerSeminaires ne retourne jamais le séminaire d'un autre cabinet", async () => {
    const { cabinet: cabinetA, seminaire: seminaireA } = await creerCabinetAvecSeminaire(
      'Cabinet Isolation A',
      'Séminaire du cabinet A',
    );
    const { cabinet: cabinetB, seminaire: seminaireB } = await creerCabinetAvecSeminaire(
      'Cabinet Isolation B',
      'Séminaire du cabinet B',
    );

    const { items: itemsA } = await listerSeminaires(cabinetA.id, {}, { page: 1 });
    const { items: itemsB } = await listerSeminaires(cabinetB.id, {}, { page: 1 });

    expect(itemsA.map((s) => s.id)).toContain(seminaireA.id);
    expect(itemsA.map((s) => s.id)).not.toContain(seminaireB.id);
    expect(itemsB.map((s) => s.id)).toContain(seminaireB.id);
    expect(itemsB.map((s) => s.id)).not.toContain(seminaireA.id);
  });

  it("listerSeminairesAgenda ne retourne jamais le séminaire d'un autre cabinet pour le même mois", async () => {
    const { cabinet: cabinetA, seminaire: seminaireA } = await creerCabinetAvecSeminaire(
      'Cabinet Isolation Agenda A',
      'Agenda A',
    );
    const { seminaire: seminaireB } = await creerCabinetAvecSeminaire('Cabinet Isolation Agenda B', 'Agenda B');

    const resultat = await listerSeminairesAgenda(cabinetA.id, { annee: 2026, mois: 9 });

    expect(resultat.map((s) => s.id)).toContain(seminaireA.id);
    expect(resultat.map((s) => s.id)).not.toContain(seminaireB.id);
  });

  it("genererFluxIcsCabinet n'inclut jamais le titre d'un séminaire d'un autre cabinet", async () => {
    const { cabinet: cabinetA } = await creerCabinetAvecSeminaire('Cabinet Isolation ICS A', 'Titre unique cabinet A ICS');
    await creerCabinetAvecSeminaire('Cabinet Isolation ICS B', 'Titre unique cabinet B ICS');

    const ics = await genererFluxIcsCabinet(cabinetA.id);

    expect(ics).toContain('Titre unique cabinet A ICS');
    expect(ics).not.toContain('Titre unique cabinet B ICS');
  });

  it('un jeton de flux ICS ne résout jamais le cabinet propriétaire d\'un autre jeton', async () => {
    const { cabinet: cabinetA } = await creerCabinetAvecSeminaire('Cabinet Isolation Jeton A', 'x');
    const { cabinet: cabinetB } = await creerCabinetAvecSeminaire('Cabinet Isolation Jeton B', 'y');

    const jetonA = await obtenirOuGenererJetonFluxIcs(cabinetA.id);
    const jetonB = await obtenirOuGenererJetonFluxIcs(cabinetB.id);

    expect(jetonA).not.toBe(jetonB);
    expect(await resoudreCabinetParJetonFluxIcs(jetonA)).toEqual({ cabinetId: cabinetA.id });
    expect(await resoudreCabinetParJetonFluxIcs(jetonB)).toEqual({ cabinetId: cabinetB.id });
    expect(await resoudreCabinetParJetonFluxIcs('jeton-jamais-emis')).toBeNull();
  });

  it("un formateur ne voit, via le filtre formateurId, que les séminaires auxquels il est affecté", async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet formateur-scope' } });
    const formateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `formateur.scope.${Date.now()}@example.test`,
        nom: 'Test',
        prenom: 'Scope',
        role: RoleUtilisateur.FORMATEUR,
        motDePasseHash: null,
      },
    });

    const seminaireAffecte = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire affecté au formateur',
        dateDebut: new Date('2026-09-05T09:00:00Z'),
        dateFin: new Date('2026-09-05T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    const seminaireNonAffecte = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire non affecté',
        dateDebut: new Date('2026-09-06T09:00:00Z'),
        dateFin: new Date('2026-09-06T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    await prisma.seminaireFormateur.create({
      data: { seminaireId: seminaireAffecte.id, utilisateurId: formateur.id, roleFormateur: 'INTERVENANT' },
    });

    const { items } = await listerSeminaires(cabinet.id, { formateurId: formateur.id }, { page: 1 });

    expect(items.map((s) => s.id)).toContain(seminaireAffecte.id);
    expect(items.map((s) => s.id)).not.toContain(seminaireNonAffecte.id);
  });

  // Étape 5 (fiche, édition, duplication) : le cas complet — obtenirSeminaire,
  // modifierSeminaire, supprimerSeminaireLogiquement — est couvert en détail
  // dans organisateur-seminaires-cycle-vie.test.ts ; le 404 (jamais 403) au
  // niveau route est couvert par tests/e2e/organisateur-seminaire-crud.spec.ts.
  // Un cas ici pour la cohérence du fichier : ni obtenirSeminaire ni
  // dupliquerSeminaire ne laissent jamais fuiter une ressource étrangère.
  it("obtenirSeminaire et dupliquerSeminaire ne renvoient jamais rien pour un séminaire d'un autre cabinet", async () => {
    const { cabinet: cabinetA, seminaire } = await creerCabinetAvecSeminaire('Cabinet Isolation Fiche A', 'Fiche A');
    const { cabinet: cabinetB } = await creerCabinetAvecSeminaire('Cabinet Isolation Fiche B', 'Fiche B');

    expect(await obtenirSeminaire(cabinetB.id, seminaire.id)).toBeNull();
    expect(await dupliquerSeminaire(cabinetB.id, seminaire.id)).toBeNull();
    expect(await obtenirSeminaire(cabinetA.id, seminaire.id)).not.toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
