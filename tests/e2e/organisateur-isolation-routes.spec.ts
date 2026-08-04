import { test, expect } from '@playwright/test';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

/**
 * Checklist étape 8 (durcissement, point 3) : une entrée par route [id] de
 * l'espace organisateur, pas seulement par fonction de lib/ — une route
 * oubliée ici est précisément celle qui fuitera. Ajouter une future route
 * cabinet-scopée à cette liste doit être une ligne, pas un nouveau test.
 *
 * Le volet "écriture" (Server Actions mutantes : modifier, supprimer,
 * changer de statut, dupliquer, ajouter un participant, importer) est
 * couvert séparément dans tests/integration/organisateur-isolation.test.ts
 * — au niveau lib, la seule unité de test possible pour une Server Action
 * (elle dépend de cookies()/next/headers, indisponible hors d'une vraie
 * requête Next.js). Ce fichier-ci ne couvre que la lecture (GET), au niveau
 * route HTTP réelle.
 */
const ROUTES_ID: { nom: string; chemin: (id: string) => string }[] = [
  { nom: 'fiche séminaire', chemin: (id) => `/organisateur/seminaires/${id}` },
  { nom: 'modifier', chemin: (id) => `/organisateur/seminaires/${id}/modifier` },
  { nom: 'participants', chemin: (id) => `/organisateur/seminaires/${id}/participants` },
  { nom: 'export participants', chemin: (id) => `/organisateur/seminaires/${id}/participants/export` },
  { nom: 'import participants', chemin: (id) => `/organisateur/seminaires/${id}/participants/import` },
];

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/organisateur/connexion');
  await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
}

test.describe("Isolation par route — un organisateur du cabinet A ne peut jamais atteindre une ressource du cabinet B", () => {
  let cabinetBId: string;
  let seminaireBId: string;

  test.beforeAll(async () => {
    const cabinetB = await prisma.cabinet.create({ data: { nom: `Cabinet e2e isolation routes ${Date.now()}` } });
    const seminaireB = await prisma.seminaire.create({
      data: {
        cabinetId: cabinetB.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire du cabinet B (isolation routes)',
        dateDebut: new Date('2026-11-01T09:00:00Z'),
        dateFin: new Date('2026-11-01T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    cabinetBId = cabinetB.id;
    seminaireBId = seminaireB.id;
  });

  test.afterAll(async () => {
    await prisma.seminaire.delete({ where: { id: seminaireBId } });
    await prisma.cabinet.delete({ where: { id: cabinetBId } });
  });

  for (const route of ROUTES_ID) {
    test(`${route.nom} : 404 sur une ressource du cabinet B, jamais 403`, async ({ page }) => {
      await connecter(page);

      // Statut HTTP directement, pas un texte affiché : "export" est un
      // Route Handler qui renvoie un JSON 404 (pas la page "introuvable" de
      // Next), les autres sont des pages. Vérifier le code plutôt que le
      // texte couvre les deux uniformément, et confirme aussi "jamais 403"
      // sans dépendre du rendu exact de chaque cas.
      const reponse = await page.goto(route.chemin(seminaireBId));
      expect(reponse?.status(), `${route.nom} devrait répondre 404`).toBe(404);
    });
  }
});
