'use client';

import { useState } from 'react';

const TAILLE_PAGE = 10;

// Pagination purement client (l'espace organisateur exige déjà JavaScript,
// voir POINTS-OUVERTS.md) : la liste reçue en prop est déjà mélangée
// côté serveur, une seule fois par chargement de page — révéler
// progressivement des tranches ne rejoue jamais le mélange, donc jamais de
// doublon/omission en cliquant « Voir plus », et deux chargements de page
// distincts obtiennent chacun un ordre différent.
export function ListeReponsesOuvertes({ reponses }: { reponses: string[] }) {
  const [nombreAffiche, setNombreAffiche] = useState(TAILLE_PAGE);
  const visibles = reponses.slice(0, nombreAffiche);
  const restantes = reponses.length - nombreAffiche;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {visibles.map((texte, index) => (
          <li key={index} className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-800)]">
            « {texte} »
          </li>
        ))}
      </ul>
      {restantes > 0 ? (
        <button
          type="button"
          onClick={() => setNombreAffiche((n) => n + TAILLE_PAGE)}
          className="min-h-[44px] self-start text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline"
        >
          Voir plus ({restantes} restante{restantes > 1 ? 's' : ''})
        </button>
      ) : null}
    </div>
  );
}
