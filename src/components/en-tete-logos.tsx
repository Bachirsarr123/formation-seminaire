// Deux logos côte à côte en haut de chaque page publique (participant,
// formateur, recueil, consultation) : cabinet à gauche, entreprise cliente à
// droite — jamais rendus comme URL brute, toujours via une route de service
// dédiée (Cabinet.logoUrl et Seminaire.logoClientUrl ne portent qu'un chemin
// de stockage local, pas une URL utilisable telle quelle) :
//   - /cabinet-logo/{cabinetId} (lib/organisateur/logo-cabinet.ts)
//   - /s/{codePublic}/logo-client (lib/organisateur/logo-client.ts)
// Fond couleur accent avec logos sur cadre blanc, hauteur fixe 60px, largeur
// proportionnelle (object-contain, jamais déformé, jamais un cercle/carré
// forcé). Les pages organisateur n'utilisent PAS ce composant : elles
// gardent uniquement le logo cabinet, affiché autrement.
interface Props {
  cabinet: { id: string; logoUrl: string | null; nom: string };
  codePublic: string;
  logoClientUrl: string | null;
}

function CadreLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="inline-flex h-[76px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] px-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-[60px] w-auto max-w-[200px] object-contain" />
    </span>
  );
}

export function EnTeteLogos({ cabinet, codePublic, logoClientUrl }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon-lg)] bg-[color:var(--couleur-accent)] px-4 py-3">
      {cabinet.logoUrl ? (
        <CadreLogo src={`/cabinet-logo/${cabinet.id}`} alt={cabinet.nom} />
      ) : (
        <span className="text-[length:var(--taille-sm)] font-medium text-[color:var(--couleur-accent-contraste)]">
          {cabinet.nom}
        </span>
      )}
      {logoClientUrl ? <CadreLogo src={`/s/${codePublic}/logo-client`} alt="" /> : null}
    </header>
  );
}
