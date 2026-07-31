import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/prisma';
import { CODE_PUBLIC_ORANGE, ipFactice } from './fixtures';

test("retour arrière après succès : bouton pas bloqué, renvoi sans doublon", async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
  await page.goto(`/s/${CODE_PUBLIC_ORANGE}/inscription`);
  const email = `retour.arriere.${Date.now()}@example.test`;
  await page.getByLabel('Prénom').fill('Retour');
  await page.getByLabel('Nom', { exact: true }).fill('Arriere');
  await page.getByLabel('E-mail').fill(email);
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: "Je m'inscris" }).click();
  await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });

  await page.goBack();

  // Le bouton ne doit jamais rester bloqué sur "Inscription en cours…".
  const bouton = page.getByRole('button', { name: /Je m'inscris|Inscription en cours/ });
  await expect(bouton).toHaveText("Je m'inscris");
  await expect(bouton).toBeEnabled();

  // Le brouillon local est purgé après un succès (par conception : il contient
  // des données personnelles, cf. correctifs lot 2) — après retour arrière, le
  // formulaire est vierge, comme au premier chargement. On resaisit les mêmes
  // coordonnées pour vérifier que le renvoi est absorbé par le dédoublonnage
  // participant plutôt que de créer une deuxième inscription.
  await page.getByLabel('Prénom').fill('Retour');
  await page.getByLabel('Nom', { exact: true }).fill('Arriere');
  await page.getByLabel('E-mail').fill(email);
  await page.waitForTimeout(3200);
  await bouton.click();
  await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });

  const nbParticipants = await prisma.participant.count({ where: { email } });
  expect(nbParticipants).toBe(1);
  const nbInscriptions = await prisma.inscription.count({ where: { participant: { email } } });
  expect(nbInscriptions).toBe(1);
});
