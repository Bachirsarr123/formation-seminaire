import type { ReactNode } from 'react';

interface Props {
  surtitre?: string;
  titre: string;
  children?: ReactNode; // sous-titre / méta (date, lieu...), déjà centré par le parent
}

// Titre systématique des pages publiques : centré, mis en avant (grande
// taille, gras, agrandi encore sur écran large) plutôt qu'un simple h1 de
// texte courant — avec une touche de couleur d'accent (surtitre en badge +
// trait) pour qu'il se détache franchement du reste du contenu.
export function TitrePage({ surtitre, titre, children }: Props) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {surtitre ? (
        <p className="rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)] px-3 py-1 text-[length:var(--taille-xs)] font-semibold uppercase tracking-wide text-[color:var(--couleur-accent-contraste)]">
          {surtitre}
        </p>
      ) : null}
      <h1 className="text-[length:var(--taille-xl)] font-bold leading-[var(--interligne-xl)] text-[color:var(--gris-900)] sm:text-[length:var(--taille-2xl)] sm:leading-[var(--interligne-2xl)]">
        {titre}
      </h1>
      <span className="h-1.5 w-16 rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)]" aria-hidden="true" />
      {children}
    </header>
  );
}
