import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/prisma';
import { creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';
import { ipFactice } from './fixtures';

let fixture: SeminaireOuvertFixture;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

test('réseau Slow 3G : formulaire utilisable, double-clic ne crée pas de doublon', async ({ page, context }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
  const client = await context.newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8, // ~400 kb/s, proche du profil "Slow 3G"
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });

  await page.goto(`/s/${fixture.codePublic}/inscription`);
  await page.getByLabel('Prénom').fill('Reseau');
  await page.getByLabel('Nom', { exact: true }).fill('Lent');
  const email = `reseau.lent.${Date.now()}@example.test`;
  await page.getByLabel('E-mail').fill(email);
  await page.waitForTimeout(3200);

  const bouton = page.getByRole('button', { name: "Je m'inscris" });

  // Double-clic rapide pendant que la requête est en vol sur un réseau lent :
  // le bouton doit se désactiver dès le premier clic (useFormStatus), donc le
  // second ne doit rien déclencher de plus.
  await bouton.click();
  await bouton.click({ force: true }).catch(() => {
    // Le bouton peut déjà être disabled à ce stade — c'est justement ce qu'on vérifie.
  });

  await expect(page).toHaveURL(/confirmation/, { timeout: 30000 });

  const nbParticipants = await prisma.participant.count({ where: { email } });
  expect(nbParticipants).toBe(1);
  const nbInscriptions = await prisma.inscription.count({ where: { participant: { email } } });
  expect(nbInscriptions).toBe(1);
});
