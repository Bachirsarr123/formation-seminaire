// Playwright ne charge pas .env automatiquement (comme tsx) : nécessaire ici
// car certaines specs importent le client Prisma directement pour vérifier
// l'absence de doublon en base, avant que le fichier de test ne soit chargé.

const BASE_URL = 'http://localhost:3000';

// Un exemplaire de chaque route dynamique déclenche la compilation du
// module de PAGE lui-même (routing par motif de fichier), indépendamment de
// la validité du paramètre — "prechauffage" n'a besoin de correspondre à
// aucune donnée réelle, chaque page traite un id/jeton inconnu comme un cas
// normal (introuvable), sans aucun effet de bord en base.
//
// À tenir à jour à chaque nouvelle route ajoutée à l'espace organisateur
// (étapes 6, 7, 8...) : une route absente d'ici retombe sur la compilation à
// la demande, avec le risque de lenteur que ce préchauffage existe pour
// éliminer. Le bug qui a motivé cette remarque : les routes de l'étape 5
// (nouveau, [id], [id]/modifier) manquaient ici, et un test a échoué en
// course avec sa propre navigation avant d'être repéré et corrigé.
const ROUTES_A_PRECHAUFFER = [
  '/',
  '/s/prechauffage',
  '/s/prechauffage/inscription',
  '/s/prechauffage/confirmation',
  '/p/prechauffage',
  '/mon-espace',
  '/mon-espace/questionnaire',
  '/mon-espace/questionnaire/merci',
  '/organisateur',
  '/organisateur/connexion',
  '/organisateur/connexion/mot-de-passe-oublie',
  '/organisateur/connexion/reinitialiser/prechauffage',
  '/organisateur/connexion/formateur',
  '/organisateur/connexion/formateur/prechauffage',
  '/organisateur/seminaires',
  '/organisateur/seminaires/agenda',
  '/organisateur/seminaires/agenda.ics',
  '/organisateur/seminaires/nouveau',
  '/organisateur/seminaires/prechauffage',
  '/organisateur/seminaires/prechauffage/modifier',
  '/organisateur/seminaires/prechauffage/participants',
  '/organisateur/seminaires/prechauffage/participants/export',
  '/organisateur/seminaires/prechauffage/participants/import',
  '/organisateur/seminaires/prechauffage/qr.png',
  '/organisateur/seminaires/prechauffage/qr.svg',
  '/organisateur/seminaires/prechauffage/questionnaire/choisir-modele',
  '/organisateur/equipe',
  '/organisateur/questionnaires',
  '/organisateur/questionnaires/prechauffage',
  '/organisateur/questionnaires/prechauffage/apercu',
  '/organisateur/questionnaires/prechauffage/questions/prechauffage/modifier',
];

/**
 * En dev, Next.js compile chaque route à la demande, au premier accès —
 * potentiellement plusieurs dizaines de secondes pour une route non
 * triviale. Sans préchauffage, c'est le PREMIER test de la suite à toucher
 * chaque route qui paie ce coût, avec un vrai risque de dépasser le timeout
 * du test plutôt qu'un simple ralentissement. Les retentatives
 * (playwright.config.ts) doivent rester un filet pour l'imprévu, pas le mode
 * de fonctionnement normal — d'où ce préchauffage explicite, séquentiel
 * (la compilation webpack est déjà coûteuse en CPU ; la paralléliser ne fait
 * que ralentir chaque compilation individuelle).
 */
async function prechaufferRoutes(): Promise<void> {
  for (const route of ROUTES_A_PRECHAUFFER) {
    try {
      await fetch(`${BASE_URL}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
    } catch {
      // Le serveur peut ne pas encore répondre pile à cet instant, ou une
      // route peut rester lente au-delà du délai — un échec ici ne bloque
      // pas la suite : les tests eux-mêmes retenteront la compilation, avec
      // les retentatives de playwright.config.ts comme filet.
    }
  }
}

export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env absent : on suppose DATABASE_URL déjà dans l'environnement (CI).
  }

  await prechaufferRoutes();
}
