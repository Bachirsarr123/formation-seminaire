import { test, expect, type Page } from '@playwright/test';
import {
  creerInscriptionAnnulee,
  creerSeminaireOuvert,
  supprimerCabinetCompletement,
  type SeminaireOuvertFixture,
} from './creer-fixtures';
import { ipFactice } from './fixtures';

async function verifierAucunDebordementHorizontal(page: Page, etape: string) {
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(debordement, `débordement horizontal détecté (${etape})`).toBe(false);
}

async function appliquerZoom200(page: Page) {
  // CSS `zoom` (non standard mais supporté par Chromium) : la façon la plus
  // fidèle de simuler un vrai zoom navigateur (Ctrl +) plutôt que de changer
  // la taille du viewport, qui est une opération différente.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('zoom', '2');
  });
}

test.describe('320px de large, avec et sans zoom 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  let fixture: SeminaireOuvertFixture;
  let jetonAnnule: string;

  test.beforeAll(async () => {
    fixture = await creerSeminaireOuvert();
    ({ jeton: jetonAnnule } = await creerInscriptionAnnulee(fixture));
  });

  test.afterAll(async () => {
    await supprimerCabinetCompletement(fixture.cabinetId);
  });

  test('page publique du séminaire', async ({ page }) => {
    await page.goto(`/s/${fixture.codePublic}`);
    await verifierAucunDebordementHorizontal(page, 'page publique, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'page publique, 200%');
  });

  test("formulaire d'inscription", async ({ page }) => {
    await page.goto(`/s/${fixture.codePublic}/inscription`);
    await verifierAucunDebordementHorizontal(page, 'formulaire, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'formulaire, 200%');
  });

  test('page de confirmation', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
    await page.goto(`/s/${fixture.codePublic}/inscription`);
    await page.getByLabel('Prénom').fill('Zoom');
    await page.getByLabel('Nom', { exact: true }).fill('Test320');
    await page.getByLabel('E-mail').fill(`zoom320.${Date.now()}@example.test`);
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: "Je m'inscris" }).click();
    await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });

    await verifierAucunDebordementHorizontal(page, 'confirmation, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'confirmation, 200%');
  });

  test('mon-espace (état annulé)', async ({ page }) => {
    await page.goto(`/p/${jetonAnnule}`);
    await expect(page).toHaveURL(/mon-espace/);

    await verifierAucunDebordementHorizontal(page, 'mon-espace, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'mon-espace, 200%');
  });
});
