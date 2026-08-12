import type { ReactNode } from 'react';

interface Props {
  surtitre?: string;
  titre: string;
  children?: ReactNode; // sous-titre / méta (date, lieu...), déjà centré par le parent
}

// Titre systématique des pages publiques : centré, toujours net à regarder
// quel que soit l'appareil, avec une touche de couleur d'accent (surtitre +
// trait) plutôt qu'un simple texte gris — le reste du contenu garde ses
// propres couleurs (voir globals.css : h1/h2/h3 restent en --gris-900 par
// défaut).
export function TitrePage({ surtitre, titre, children }: Props) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      {surtitre ? (
        <p className="text-[length:var(--taille-xs)] font-semibold uppercase tracking-wide text-[color:var(--couleur-accent-texte)]">
          {surtitre}
        </p>
      ) : null}
      <h1 className="text-[length:var(--taille-xl)] leading-[var(--interligne-xl)] text-[color:var(--gris-900)]">{titre}</h1>
      <span className="h-1 w-12 rounded-[var(--rayon-plein)] bg-[color:var(--couleur-accent)]" aria-hidden="true" />
      {children}
    </header>
  );
}
