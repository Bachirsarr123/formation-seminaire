// Aucune dépendance ('server-only', Prisma...) : ce fichier est importé à la
// fois par session.ts (runtime Node.js) et par middleware.ts (Edge Runtime,
// incompatible avec Prisma). Les deux doivent s'accorder sur le même nom de
// cookie et la même durée sans jamais partager de code non portable à l'Edge.
export const NOM_COOKIE_SESSION = 'organisateur_session';
export const DUREE_SESSION_MS = 12 * 60 * 60 * 1000;
