import { test, expect } from '@playwright/test';
import { creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';
import { ipFactice } from './fixtures';

let fixture: SeminaireOuvertFixture;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

test('focus visible à chaque étape, honeypot jamais atteint, aucun piège clavier', async ({ page }) => {
  await page.goto(`/s/${fixture.codePublic}/inscription`);

  const nomsRencontres: string[] = [];
  let honeypotAtteint = false;

  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    // eslint-disable-next-line no-await-in-loop
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        name: el.getAttribute('name'),
        boxShadow: style.boxShadow,
      };
    });
    if (!info) continue;

    if (info.name === 'site_web') honeypotAtteint = true;
    nomsRencontres.push(info.name ?? info.tag);

    if (info.tag === 'INPUT' || info.tag === 'BUTTON') {
      expect(info.boxShadow, `anneau de focus visible sur ${info.name ?? info.tag}`).not.toBe('none');
      expect(info.boxShadow, `anneau de focus non vide sur ${info.name ?? info.tag}`).not.toBe('');
    }
  }

  expect(honeypotAtteint, 'le champ honeypot ne doit jamais recevoir le focus clavier').toBe(false);
  expect(nomsRencontres).toContain('prenom');
  expect(nomsRencontres).toContain('nom');
  expect(nomsRencontres).toContain('email');
  expect(nomsRencontres).toContain('telephone');
});

test('inscription complétée entièrement au clavier (aucune souris)', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
  await page.goto(`/s/${fixture.codePublic}/inscription`);

  await page.getByLabel('Prénom').focus();
  await page.keyboard.type('Clavier');
  await page.keyboard.press('Tab');
  await page.keyboard.type('SeulementClavier');
  await page.keyboard.press('Tab');
  await page.keyboard.type(`clavier.${Date.now()}@example.test`);

  await page.waitForTimeout(3200);

  const bouton = page.getByRole('button', { name: "Je m'inscris" });
  await bouton.focus();
  await expect(bouton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });
});
