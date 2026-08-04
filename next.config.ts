import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Nécessaire pour previsualiserImportAction (lot 4, étape 7) : la limite
    // par défaut de Next (1 Mo) s'applique à l'intégralité du payload
    // multipart de la Server Action, pas au seul fichier — l'overhead
    // d'encodage la dépasserait de peu pour un CSV de 1 Mo (le plafond
    // applicatif, cf. PLAFOND_TAILLE_OCTETS). confirmerImportAction, elle,
    // ne porte plus qu'un identifiant d'aperçu et n'a pas besoin de cette
    // marge.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
