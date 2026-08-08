import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // 12 Mo : couvre le plus grand besoin actuel — l'upload d'un support de
    // cours (plafond applicatif 10 Mo, cf. PLAFOND_TAILLE_SUPPORT_OCTETS),
    // avec la même marge que pour l'import CSV (la limite s'applique à
    // l'intégralité du payload multipart de la Server Action, pas au seul
    // fichier). Le CSV (plafond 1 Mo, PLAFOND_TAILLE_OCTETS) tient largement
    // dans cette même limite, pas besoin d'un réglage séparé.
    serverActions: {
      bodySizeLimit: '12mb',
    },
    // Limite SÉPARÉE de la précédente : src/middleware.ts tourne sur
    // /organisateur/:path* (vérification de l'en-tête Origin) et lit donc
    // lui aussi le corps de la requête avant qu'elle n'atteigne la Server
    // Action — sous son propre plafond par défaut (10 Mo), qui tronque
    // silencieusement tout upload plus gros et casse le multipart
    // ("expected boundary after body") au lieu de laisser
    // ajouterSupportAction répondre avec un message clair. Doit rester
    // cohérent avec bodySizeLimit ci-dessus.
    middlewareClientMaxBodySize: '12mb',
  },
};

export default nextConfig;
