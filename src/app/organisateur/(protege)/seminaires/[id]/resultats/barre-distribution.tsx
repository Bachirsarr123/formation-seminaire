import type { DistributionValeur } from '@/lib/questionnaire/resultats';

// Pas de bibliothèque de graphiques : une div dont la largeur est un
// pourcentage, du CSS pur (contrainte du lot).
export function BarreDistribution({ distribution }: { distribution: DistributionValeur[] }) {
  return (
    <div className="flex flex-col gap-1">
      {distribution.map((valeur) => (
        <div key={valeur.valeur} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-[length:var(--taille-sm)] text-[color:var(--gris-700)]" title={valeur.libelle}>
            {valeur.libelle}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)]">
            <div className="h-4 rounded-[var(--rayon-sm)] bg-[color:var(--gris-700)]" style={{ width: `${valeur.pourcentage}%` }} />
          </div>
          <span className="chiffre w-20 shrink-0 text-right text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            {valeur.nombre} ({valeur.pourcentage}%)
          </span>
        </div>
      ))}
    </div>
  );
}
