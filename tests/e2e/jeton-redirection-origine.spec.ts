import { test, expect } from '@playwright/test';
import { creerInscriptionAnnulee, creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';

let fixture: SeminaireOuvertFixture;
let jeton: string;

test.beforeAll(async () => {
  fixture = await creerSeminaireOuvert();
  ({ jeton } = await creerInscriptionAnnulee(fixture));
});

test.afterAll(async () => {
  await supprimerCabinetCompletement(fixture.cabinetId);
});

// Bug de production (jamais visible en local, pas de proxy devant le
// serveur de dev) : /p/{jeton} redirigeait vers /mon-espace en reconstruisant
// l'URL à partir de `request.url`, qui reflète l'URL interne que Next.js se
// construit lui-même plutôt que l'hôte public vu par le client derrière un
// proxy comme Render — observé en production sous la forme
// `http://localhost:PORT/mon-espace`. En envoyant nous-mêmes les en-têtes
// qu'un proxy ajouterait (X-Forwarded-Host/-Proto), on vérifie que la
// redirection les respecte, sans dépendre d'un vrai proxy pour reproduire le
// bug.
test('/p/{jeton} redirige en respectant X-Forwarded-Host/-Proto, jamais request.url', async ({ request }) => {
  const reponse = await request.get(`/p/${jeton}`, {
    headers: { 'x-forwarded-host': 'seminaire-demo.onrender.com', 'x-forwarded-proto': 'https' },
    maxRedirects: 0,
  });

  expect(reponse.status()).toBeGreaterThanOrEqual(300);
  expect(reponse.status()).toBeLessThan(400);
  expect(reponse.headers()['location']).toBe('https://seminaire-demo.onrender.com/mon-espace');
});
