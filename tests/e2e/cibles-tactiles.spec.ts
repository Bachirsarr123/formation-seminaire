import { test, expect, type Locator } from '@playwright/test';
import { creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';
import { ipFactice } from './fixtures';

const CIBLE_MINIMUM = 44;

async function verifierCibleTactile(locator: Locator, nom: string) {
  await expect(locator, `${nom} doit être visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${nom} doit avoir une position mesurable`).not.toBeNull();
  if (box) {
    expect(box.height, `${nom} — hauteur ≥ ${CIBLE_MINIMUM}px (obtenu ${box.height}px)`).toBeGreaterThanOrEqual(
      CIBLE_MINIMUM - 1, // marge d'1px pour l'arrondi sous-pixel
    );
  }
}

let fixture: SeminaireOuvertFixture;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

test('cibles tactiles ≥ 44px — page publique et formulaire', async ({ page }) => {
  await page.goto(`/s/${fixture.codePublic}`);
  await verifierCibleTactile(page.getByRole('link', { name: "Je m'inscris" }), 'CTA "Je m\'inscris" (page publique)');

  await page.goto(`/s/${fixture.codePublic}/inscription`);
  await verifierCibleTactile(page.getByRole('button', { name: "Je m'inscris" }), 'bouton de soumission');

  // La case à cocher elle-même est petite (20px, rendu natif) : la cible
  // réelle est le <label> qui l'enveloppe — un clic n'importe où dessus
  // active la case (comportement natif du <label for>/wrapping).
  await verifierCibleTactile(
    page.locator('label', { hasText: 'informations sur les prochaines formations' }),
    'label case "communications"',
  );
  await verifierCibleTactile(
    page.locator('label', { hasText: "l'employeur qui finance" }),
    'label case "partage employeur"',
  );
});

test('cibles tactiles ≥ 44px — confirmation et mon-espace', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
  await page.goto(`/s/${fixture.codePublic}/inscription`);
  await page.getByLabel('Prénom').fill('Cible');
  await page.getByLabel('Nom', { exact: true }).fill('Tactile');
  await page.getByLabel('E-mail').fill(`cible.tactile.${Date.now()}@example.test`);
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: "Je m'inscris" }).click();
  await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });

  await verifierCibleTactile(page.getByRole('button', { name: 'Copier' }), 'bouton Copier');
  await verifierCibleTactile(page.getByRole('link', { name: 'Ajouter à mon calendrier' }), 'lien calendrier (.ics)');

  await page.goto('/mon-espace');
  await verifierCibleTactile(page.getByRole('button', { name: 'Annuler mon inscription' }), 'lien "Annuler mon inscription"');

  await page.getByRole('button', { name: 'Annuler mon inscription' }).click();
  await verifierCibleTactile(page.getByRole('button', { name: 'Oui, annuler' }), 'bouton "Oui, annuler"');
  await verifierCibleTactile(page.getByRole('button', { name: 'Non, revenir' }), 'bouton "Non, revenir"');

  await verifierCibleTactile(page.getByRole('button', { name: 'Autoriser' }).first(), 'bouton "Autoriser" (préférences)');
});
