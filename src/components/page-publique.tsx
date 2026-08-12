import type { CSSProperties, ReactNode } from 'react';
import { PiedDePageCabinet } from './pied-de-page-cabinet';

interface CabinetPourPiedDePage {
  nom: string;
  adresse: string | null;
  telephoneContact: string | null;
  emailContact: string | null;
}

interface Props {
  style?: CSSProperties;
  cabinet?: CabinetPourPiedDePage | null;
  children: ReactNode;
}

// Coquille commune des pages publiques (participant, formateur, recueil,
// consultation) : <main> occupe toute la largeur de l'appareil, la colonne
// de contenu se centre et s'élargit progressivement (téléphone -> tablette
// -> ordinateur), et le pied de page — en dehors de cette colonne, comme
// <main> — s'étire lui aussi sur toute la largeur disponible quel que soit
// l'appareil.
export function PagePublique({ style, cabinet, children }: Props) {
  return (
    <main style={style} className="flex min-h-screen flex-col bg-[color:var(--gris-050)]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-[var(--espace-8)] p-4 pb-12 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        {children}
      </div>
      {cabinet ? <PiedDePageCabinet cabinet={cabinet} /> : null}
    </main>
  );
}
