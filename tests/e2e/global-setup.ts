// Playwright ne charge pas .env automatiquement (comme tsx) : nécessaire ici
// car certaines specs importent le client Prisma directement pour vérifier
// l'absence de doublon en base, avant que le fichier de test ne soit chargé.
export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env absent : on suppose DATABASE_URL déjà dans l'environnement (CI).
  }
}
