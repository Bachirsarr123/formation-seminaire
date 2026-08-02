import { test, expect } from '@playwright/test';
import { JETON_ANNULE } from './fixtures';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

test.describe('Page d\'accueil "/" — résout le 404 du lot 2, dans les trois cas', () => {
  test('visiteur anonyme : page sobre du cabinet, jamais de 404', async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Cabinet Méridien Formation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connexion organisateur' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accéder à mon espace' })).toHaveCount(0);

    await contexte.close();
  });

  test('organisateur déjà connecté : redirection immédiate vers le tableau de bord', async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();

    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/organisateur$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/organisateur$/);

    await contexte.close();
  });

  test('participant porteur d\'un cookie valide : proposition de rejoindre son espace', async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();

    // Pose le cookie de session participant via un jeton réel (inscription
    // ANNULEE : résout tout de même un contexte, cf. jeton-annule.spec.ts).
    await page.goto(`/p/${JETON_ANNULE}`);
    await expect(page).toHaveURL(/\/mon-espace$/);

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Accéder à mon espace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connexion organisateur' })).toHaveCount(0);

    await contexte.close();
  });
});
