import { defineConfig, devices } from '@playwright/test';

// Séparé de Vitest (tests/**/*.test.ts) : ces specs pilotent un vrai
// navigateur (Chromium fourni par Playwright) pour vérifier ce qui ne se
// teste pas au niveau lib (JS désactivé, débordement à 320px/zoom, tailles
// de cibles tactiles, navigation clavier, rendu visuel des couleurs d'accent).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Un réessai : absorbe la lenteur de démarrage à froid observée sur cet
  // hôte (lancement de Chromium, tout premier screenshot) sans masquer un
  // vrai bug — un test qui échoue deux fois de suite pour la même raison
  // logique (pas un timeout d'infra) reste en échec.
  retries: 1,
  // Hôte de dev partagé et sous charge (cf. tout le fil de discussion) : la
  // première requête sur chaque route déclenche une compilation à la volée
  // en dev qui peut prendre plus de 2 minutes. Marges généreuses plutôt que
  // des échecs qui ne seraient que des timeouts d'infrastructure.
  timeout: 180000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 150000,
  },
  // Pas de webServer géré ici : le serveur de dev est démarré et préchauffé
  // manuellement en amont (voir le fil de discussion) — laisser Playwright
  // essayer d'en lancer un second a provoqué un conflit de port et un plantage
  // lié à un fichier spécifique à Windows/OneDrive dans .next/.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
