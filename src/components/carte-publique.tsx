import type { ReactNode } from 'react';

// Carte centrale des pages publiques (participant, formateur, recueil,
// consultation) : fond clair, ombre légère, coins arrondis, espacement
// généreux entre sections — le contenu (titres, formulaires...) garde ses
// propres styles, cette carte ne fait que l'envelopper.
export function CartePublique({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-[var(--espace-8)] rounded-[var(--rayon-lg)] bg-[color:var(--gris-000)] p-6 shadow-[var(--ombre-md)] sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
