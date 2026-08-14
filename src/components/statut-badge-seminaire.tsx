import type { StatutSeminaire } from '@prisma/client';
import { LIBELLE_STATUT_SEMINAIRE } from '@/lib/libelles';

// Une couleur par statut plutôt qu'un seul badge gris : BROUILLON et ARCHIVE
// restent neutres (rien à distinguer d'un état « au repos »), les trois
// statuts actifs du cycle de vie (PUBLIE -> EN_COURS -> CLOTURE) prennent
// chacun une des trois teintes dérivées du cabinet (lib/design/couleur-accent.ts)
// — accent/secondaire/tertiaire vont déjà ensemble par construction, donc ce
// mapping reste cohérent quelle que soit la couleur choisie par le cabinet.
const STYLE_PAR_STATUT: Record<StatutSeminaire, { fond: string; texte: string }> = {
  BROUILLON: { fond: 'var(--gris-100)', texte: 'var(--gris-700)' },
  PUBLIE: { fond: 'color-mix(in srgb, var(--couleur-secondaire) 16%, white)', texte: 'var(--couleur-secondaire-texte)' },
  EN_COURS: { fond: 'color-mix(in srgb, var(--couleur-accent) 16%, white)', texte: 'var(--couleur-accent-texte)' },
  CLOTURE: { fond: 'color-mix(in srgb, var(--couleur-tertiaire) 16%, white)', texte: 'var(--couleur-tertiaire-texte)' },
  ARCHIVE: { fond: 'var(--gris-100)', texte: 'var(--gris-500)' },
};

export function StatutBadgeSeminaire({ statut }: { statut: StatutSeminaire }) {
  const style = STYLE_PAR_STATUT[statut];
  return (
    <span
      className="inline-flex items-center rounded-[var(--rayon-plein)] px-3 py-1 text-[length:var(--taille-xs)] font-semibold"
      style={{ background: style.fond, color: style.texte }}
    >
      {LIBELLE_STATUT_SEMINAIRE[statut]}
    </span>
  );
}
