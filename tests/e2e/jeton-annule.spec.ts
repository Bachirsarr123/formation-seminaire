import { test, expect } from '@playwright/test';
import {
  creerInscriptionAnnulee,
  creerSeminaireOuvert,
  supprimerCabinetCompletement,
  type SeminaireOuvertFixture,
} from './creer-fixtures';

let fixture: SeminaireOuvertFixture;
let jeton: string;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
  ({ jeton } = await creerInscriptionAnnulee(fixture));
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

test("/p/{jeton} sur une inscription ANNULEE arrive sur l'état annulé, pas un 404", async ({ page }) => {
  await page.goto(`/p/${jeton}`);

  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(page.getByText('Votre inscription est annulée.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me réinscrire' })).toBeVisible();
});
