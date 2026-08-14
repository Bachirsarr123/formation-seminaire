import type { ReactNode } from 'react';

// Carte centrale des pages publiques (participant, formateur, recueil,
// consultation) : fond clair, ombre légère, coins arrondis, espacement
// généreux entre sections — le contenu (titres, formulaires...) garde ses
// propres styles, cette carte ne fait que l'envelopper. Le liseré en
// dégradé (tertiaire -> accent -> secondaire, lib/design/couleur-accent.ts)
// est la seule touche de couleur portée par la carte elle-même — le contenu
// à l'intérieur reste sur le gris habituel.
export function CartePublique({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative flex flex-col gap-[var(--espace-8)] overflow-hidden rounded-[var(--rayon-lg)] bg-[color:var(--gris-000)] p-6 shadow-[var(--ombre-md)] before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-[linear-gradient(90deg,var(--couleur-tertiaire),var(--couleur-accent),var(--couleur-secondaire))] before:content-[''] sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
