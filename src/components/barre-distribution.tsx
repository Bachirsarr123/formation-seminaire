import type { DistributionValeur } from '@/lib/questionnaire/resultats';

// Pas de bibliothèque de graphiques : une div dont la largeur est un
// pourcentage, du CSS pur (contrainte du lot).
//
// Une couleur par rang plutôt qu'un gris uniforme pour toutes les barres :
// les trois teintes dérivées du cabinet (accent/secondaire/tertiaire, voir
// lib/design/couleur-accent.ts) vont déjà ensemble par construction, donc ce
// cycle reste harmonieux quelle que soit la couleur choisie par le cabinet —
// il rend juste chaque ligne de la distribution visuellement distincte.
const COULEURS_BARRE = ['var(--couleur-accent)', 'var(--couleur-secondaire)', 'var(--couleur-tertiaire)'];

export function BarreDistribution({ distribution }: { distribution: DistributionValeur[] }) {
  return (
    <div className="flex flex-col gap-1">
      {distribution.map((valeur, index) => (
        <div key={valeur.valeur} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-[length:var(--taille-sm)] text-[color:var(--gris-700)]" title={valeur.libelle}>
            {valeur.libelle}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)]">
            <div
              className="h-4 rounded-[var(--rayon-sm)]"
              style={{ width: `${valeur.pourcentage}%`, background: COULEURS_BARRE[index % COULEURS_BARRE.length] }}
            />
          </div>
          <span className="chiffre w-20 shrink-0 text-right text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            {valeur.nombre} ({valeur.pourcentage}%)
          </span>
        </div>
      ))}
    </div>
  );
}
