import { execFileSync } from 'node:child_process';
import { verifierEnvironnementDev } from '../src/lib/garde-environnement-dev';

/**
 * Point d'entrée unique pour réinitialiser la base locale. `prisma migrate
 * reset` est une commande CLI tierce qu'on ne peut pas patcher de
 * l'intérieur : la garde doit donc s'exécuter AVANT de l'invoquer, pas dans
 * seed.ts (le seed ne se lance qu'une fois la base déjà détruite — trop
 * tard). N'appeler `prisma migrate reset` qu'à travers ce script, jamais
 * directement.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on suppose que DATABASE_URL est déjà dans l'environnement.
}

verifierEnvironnementDev('reset-db');

console.log('Environnement local confirmé — lancement de `prisma migrate reset --force`.');

// On invoque directement le point d'entrée JS de Prisma via `node`, plutôt
// que le binaire `npx`/`prisma` : sous Windows ce sont des shims `.cmd`, que
// execFileSync ne peut lancer sans `shell: true` (EINVAL) — et `shell: true`
// avec des arguments est justement ce que Node déconseille désormais
// (DEP0190, concaténation shell non échappée). Cette approche reste
// cross-platform sans passer par un shell du tout.
const pointEntreePrisma = require.resolve('prisma/build/index.js');
execFileSync(process.execPath, [pointEntreePrisma, 'migrate', 'reset', '--force'], { stdio: 'inherit' });
