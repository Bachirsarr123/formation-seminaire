import type { ReactNode } from 'react';

interface Props {
  surtitre?: string;
  titre: string;
  children?: ReactNode; // sous-titre / méta (date, lieu...), déjà centré par le parent
}

// Titre systématique des pages publiques : posé dans son propre bandeau
// (fond gris clair, coins arrondis, cadre à part dans la carte blanche),
// centré, très grand et gras — agrandi encore sur écran large — avec un
// badge de couleur accent au-dessus et un double trait d'accent en dessous.
// Doit se détacher franchement du reste du contenu, pas se fondre dans un
// simple h1 de texte courant.
export function TitrePage({ surtitre, titre, children }: Props) {
  return (
    <header className="flex flex-col items-center gap-4 rounded-[var(--rayon-lg)] bg-[color:var(--gris-050)] px-6 py-8 text-center">
      {surtitre ? (
        <p className="rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)] px-4 py-1.5 text-[length:var(--taille-xs)] font-semibold uppercase tracking-wide text-[color:var(--couleur-accent-contraste)]">
          {surtitre}
        </p>
      ) : null}
      <h1 className="text-[length:var(--taille-xl)] font-bold leading-[var(--interligne-xl)] text-[color:var(--gris-900)] sm:text-[length:var(--taille-2xl)] sm:leading-[var(--interligne-2xl)] md:text-[44px] md:leading-[48px]">
        {titre}
      </h1>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-1.5 w-10 rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent-appui)]" />
        <span className="h-1.5 w-16 rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)]" />
        <span className="h-1.5 w-10 rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent-appui)]" />
      </div>
      {children}
    </header>
  );
}
