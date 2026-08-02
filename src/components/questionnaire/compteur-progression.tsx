'use client';

import { useEffect, useState } from 'react';

/**
 * Rehaussement JavaScript uniquement : sans JS, ce composant ne s'hydrate
 * jamais et ne rend donc rien (voir .barre-progression dans globals.css).
 * Un compteur qui ne se met jamais à jour serait pire qu'un compteur absent —
 * on préfère l'absence pure à un chiffre figé et faux.
 */
export function CompteurProgression({ formId, champs }: { formId: string; champs: string[] }) {
  const [nbRepondues, setNbRepondues] = useState<number | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    function recompter() {
      const donnees = new FormData(form as HTMLFormElement);
      const n = champs.filter((champ) => {
        const valeur = donnees.get(champ);
        return typeof valeur === 'string' && valeur.trim() !== '';
      }).length;
      setNbRepondues(n);
    }

    recompter();
    form.addEventListener('input', recompter);
    form.addEventListener('change', recompter);
    return () => {
      form.removeEventListener('input', recompter);
      form.removeEventListener('change', recompter);
    };
  }, [formId, champs]);

  if (nbRepondues === null) return null;

  return (
    <span className="chiffre text-[color:var(--gris-700)]">
      {nbRepondues} sur {champs.length} répondues
    </span>
  );
}
