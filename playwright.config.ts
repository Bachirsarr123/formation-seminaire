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
  reporter: [['list'], ['html', { open: 'never' }]],
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
  // reuseExistingServer: true en local — réutilise le serveur déjà lancé
  // (évite le conflit de port rencontré plus tôt) ; false en CI, où aucun
  // serveur n'est encore démarré et Playwright doit en lancer un lui-même.
  // Sans ce bloc, la suite est impossible à exécuter sur une machine propre.
  webServer: {
    command: 'npm run dev',
    // Vérification par connexion TCP brute, pas par requête HTTP : l'app n'a
    // aucune route qui répond 2xx/3xx sur "/" (toutes les routes réelles sont
    // sous /p/[jeton], /s/[codePublic], /mon-espace — un 404 sur "/" est le
    // comportement correct de l'app). Avec `url`, Playwright n'aurait jamais
    // considéré le serveur comme prêt et aurait toujours expiré au bout de
    // 180s malgré un serveur réellement opérationnel en ~10s.
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
