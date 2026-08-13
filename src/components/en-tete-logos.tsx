'use client';

import { useState } from 'react';

// Deux logos côte à côte en haut de chaque page publique (participant,
// formateur, recueil, consultation) : cabinet à gauche, entreprise cliente à
// droite — jamais rendus comme URL brute, toujours via une route de service
// dédiée (Cabinet.logoUrl et Seminaire.logoClientUrl ne portent que l'id
// d'une ligne fichier_stocke, jamais une URL utilisable telle quelle) :
//   - /cabinet-logo/{cabinetId} (lib/organisateur/logo-cabinet.ts)
//   - /s/{codePublic}/logo-client (lib/organisateur/logo-client.ts)
// Fond couleur accent avec logos sur cadre blanc, hauteur plafonnée (50px
// sur mobile, 60px à partir de sm:), largeur proportionnelle (object-contain,
// jamais déformé, jamais un cercle/carré forcé, jamais agrandi au-delà de sa
// taille réelle). Composant client (pas de fetch, seulement des props) : le
// hook onError ci-dessous a besoin du navigateur pour masquer l'emplacement
// si l'image référencée ne charge pas (id valide en base mais fichier
// introuvable — voir lireFichierSupportOuNull), plutôt que de laisser
// s'afficher l'icône d'image cassée du navigateur. Les pages organisateur
// n'utilisent PAS ce composant : elles gardent uniquement le logo cabinet,
// affiché autrement.
interface Props {
  cabinet: { id: string; logoUrl: string | null; nom: string };
  codePublic: string;
  logoClientUrl: string | null;
}

function CadreLogo({ src, alt, onErreur }: { src: string; alt: string; onErreur: () => void }) {
  return (
    <span className="inline-flex h-[66px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] px-3 sm:h-[76px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[50px] w-auto max-w-[100px] object-contain sm:max-h-[60px] sm:max-w-[200px]"
        onError={onErreur}
      />
    </span>
  );
}

export function EnTeteLogos({ cabinet, codePublic, logoClientUrl }: Props) {
  const [logoCabinetEnErreur, setLogoCabinetEnErreur] = useState(false);
  const [logoClientEnErreur, setLogoClientEnErreur] = useState(false);

  const afficherLogoCabinet = Boolean(cabinet.logoUrl) && !logoCabinetEnErreur;
  const afficherLogoClient = Boolean(logoClientUrl) && !logoClientEnErreur;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon-lg)] bg-[color:var(--couleur-accent)] px-4 py-3">
      {afficherLogoCabinet ? (
        // `?v=` : chemin de stockage lui-même comme témoin de version — les
        // routes /cabinet-logo et /s/.../logo-client sont mises en cache 1h
        // (voir leurs headers), mais leur URL ne change pas quand
        // l'organisateur remplace le fichier. Sans ce paramètre, un logo
        // remplacé resterait caché avec l'ancien jusqu'à expiration.
        <CadreLogo
          src={`/cabinet-logo/${cabinet.id}?v=${encodeURIComponent(cabinet.logoUrl!)}`}
          alt={cabinet.nom}
          onErreur={() => setLogoCabinetEnErreur(true)}
        />
      ) : (
        <span className="text-[length:var(--taille-sm)] font-medium text-[color:var(--couleur-accent-contraste)]">
          {cabinet.nom}
        </span>
      )}
      {afficherLogoClient ? (
        <CadreLogo
          src={`/s/${codePublic}/logo-client?v=${encodeURIComponent(logoClientUrl!)}`}
          alt=""
          onErreur={() => setLogoClientEnErreur(true)}
        />
      ) : null}
    </header>
  );
}
