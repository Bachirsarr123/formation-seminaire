'use client';

import { useState } from 'react';

export function BoutonCopier({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible (navigateur ancien, contexte non
      // sécurisé) : le lien reste affiché en clair, copiable à la main.
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
    >
      {copie ? 'Copié' : 'Copier'}
    </button>
  );
}
