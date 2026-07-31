import { test, expect } from '@playwright/test';
import { JETON_ANNULE } from './fixtures';

test("/p/{jeton} sur une inscription ANNULEE arrive sur l'état annulé, pas un 404", async ({ page }) => {
  await page.goto(`/p/${JETON_ANNULE}`);

  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(page.getByText('Votre inscription est annulée.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me réinscrire' })).toBeVisible();
});
