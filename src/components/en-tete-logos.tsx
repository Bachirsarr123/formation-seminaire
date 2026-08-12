// Deux logos côte à côte en haut de chaque page publique (participant,
// formateur, recueil, consultation) : cabinet à gauche (Cabinet.logoUrl,
// URL externe), entreprise cliente à droite (Seminaire.logoClientUrl,
// stockage local — servi par la route publique /s/{codePublic}/logo-client,
// qui applique déjà la même visibilité que la page séminaire elle-même).
// Les pages organisateur n'utilisent PAS ce composant : elles gardent
// uniquement le logo cabinet.
interface Props {
  cabinet: { logoUrl: string | null; nom: string };
  codePublic: string;
  logoClientUrl: string | null;
}

export function EnTeteLogos({ cabinet, codePublic, logoClientUrl }: Props) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {cabinet.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cabinet.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : null}
        <span className="text-[color:var(--gris-600)] text-[length:var(--taille-sm)]">{cabinet.nom}</span>
      </div>
      {logoClientUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/s/${codePublic}/logo-client`} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : null}
    </header>
  );
}
