import { test, expect } from '@playwright/test';
import { creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';
import { ipFactice } from './fixtures';

// Contrainte la plus importante du lot : le formulaire doit fonctionner
// entièrement sans JavaScript côté page (Server Action + formulaire HTML
// natif). javaScriptEnabled: false désactive l'exécution JS de la PAGE —
// Playwright pilote toujours le navigateur via CDP, pas via le JS de la page.
test.use({ javaScriptEnabled: false });

let fixture: SeminaireOuvertFixture;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

test("inscription complète sans JavaScript, jusqu'à la confirmation", async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
  await page.goto(`/s/${fixture.codePublic}/inscription`);

  await page.getByLabel('Prénom').fill('Aissatou');
  await page.getByLabel('Nom', { exact: true }).fill('Ba');
  const email = `aissatou.sansjs.${Date.now()}@example.test`;
  await page.getByLabel('E-mail').fill(email);

  // Sous le délai anti-spam minimum (3s), un remplissage instantané serait
  // rejeté comme suspect — un humain met naturellement plus de temps.
  await page.waitForTimeout(3200);

  await page.getByRole('button', { name: "Je m'inscris" }).click();

  await expect(page).toHaveURL(/\/confirmation/, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: 'Inscription confirmée' })).toBeVisible();
  // Le lien personnel est affiché en clair, jamais dans l'URL.
  await expect(page.getByText(/\/p\//)).toBeVisible();
  expect(page.url()).not.toContain('/p/');
});
