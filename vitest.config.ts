import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests d'intégration réels contre une seule instance Postgres partagée
    // (verrous transactionnels compris, cf. jauge-places-concurrence) : les
    // exécuter en parallèle multiplie les connexions/locks concurrents pour
    // un gain de vitesse minime sur cette suite, au prix de timeouts
    // parasites. Un fichier à la fois, avec une marge de timeout généreuse.
    fileParallelism: false,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Le paquet `server-only` ne lève une exception que lorsqu'il est résolu
    // SANS la condition d'export "react-server" (c'est ainsi que le bundler
    // de Next.js le fait échouer uniquement côté client). Vitest/Vite ne
    // connaissent pas cette condition par défaut : sans elle, `server-only`
    // explose aussi pour du code serveur légitime testé directement. On la
    // déclare ici pour reproduire la résolution de Next.js dans les tests.
    conditions: ['react-server'],
  },
});
