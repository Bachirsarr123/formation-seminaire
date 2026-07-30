interface Rvb {
  r: number;
  g: number;
  b: number;
}

interface Tsl {
  h: number;
  s: number;
  l: number;
}

const GRIS_950 = '#0C0D10';
const GRIS_000 = '#FAFBFC';
const BLANC = '#FFFFFF';
const ACCENT_PAR_DEFAUT = '#2D5DA8';
const CONTRASTE_MINIMUM_TEXTE = 4.5;

function hexVersRvb(hex: string): Rvb {
  const nettoye = hex.replace('#', '');
  const valeur = nettoye.length === 3 ? nettoye.split('').map((c) => c + c).join('') : nettoye;
  const entier = parseInt(valeur, 16);
  return { r: (entier >> 16) & 255, g: (entier >> 8) & 255, b: entier & 255 };
}

function rvbVersHex({ r, g, b }: Rvb): string {
  const composant = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${composant(r)}${composant(g)}${composant(b)}`.toUpperCase();
}

function canalLineaire(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminanceRelative(hex: string): number {
  const { r, g, b } = hexVersRvb(hex);
  return 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(g) + 0.0722 * canalLineaire(b);
}

function ratioContraste(hexA: string, hexB: string): number {
  const lA = luminanceRelative(hexA);
  const lB = luminanceRelative(hexB);
  const [clair, sombre] = lA >= lB ? [lA, lB] : [lB, lA];
  return (clair + 0.05) / (sombre + 0.05);
}

function rvbVersHsl({ r, g, b }: Rvb): Tsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslVersRvb({ h, s, l }: Tsl): Rvb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const versCanal = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: versCanal(h + 1 / 3) * 255, g: versCanal(h) * 255, b: versCanal(h - 1 / 3) * 255 };
}

export interface JetonsAccent {
  accent: string;
  accentContraste: string; // texte sur fond accent (boutons) — blanc ou gris-950
  accentAppui: string; // état pressé/survol, assombri ~12%
  accentTexte: string; // accent utilisé COMME couleur de texte — jamais l'accent brut
}

/**
 * Dérive, à partir de cabinet.couleur_primaire (peut être absente), les
 * jetons dépendants. --couleur-accent ne doit JAMAIS servir de couleur de
 * texte : sur un vert vif (#16A34A) ou un orange (#F97316), le contraste
 * contre blanc échoue l'AA (3,30 et 2,80). --couleur-accent-texte est donc
 * assombri par pas, en conservant teinte et saturation, jusqu'à atteindre
 * 4,5:1 contre --gris-000 — vérifié par test, pas supposé
 * (tests/unit/couleur-accent.test.ts).
 */
export function deriverJetonsAccent(accentBrut?: string | null): JetonsAccent {
  const accent = accentBrut && /^#[0-9a-fA-F]{3,6}$/.test(accentBrut) ? accentBrut : ACCENT_PAR_DEFAUT;

  const accentContraste = ratioContraste(accent, BLANC) >= ratioContraste(accent, GRIS_950) ? BLANC : GRIS_950;

  const hsl = rvbVersHsl(hexVersRvb(accent));
  const accentAppui = rvbVersHex(hslVersRvb({ ...hsl, l: Math.max(0, hsl.l - 0.12) }));

  let l = hsl.l;
  let accentTexte = accent;
  let iterations = 0;
  while (ratioContraste(accentTexte, GRIS_000) < CONTRASTE_MINIMUM_TEXTE && iterations < 40) {
    l = Math.max(0, l - 0.025);
    accentTexte = rvbVersHex(hslVersRvb({ ...hsl, l }));
    iterations += 1;
  }

  return { accent, accentContraste, accentAppui, accentTexte };
}

/**
 * Convertit les jetons dérivés en propriétés CSS inline. L'accent est
 * contextuel au cabinet affiché, jamais global à toute l'application — on
 * l'injecte sur le conteneur le plus proche (page séminaire, carte
 * d'inscription dans /mon-espace), pas sur <html>.
 */
export function stylesJetonsAccent(jetons: JetonsAccent): Record<string, string> {
  return {
    '--couleur-accent': jetons.accent,
    '--couleur-accent-contraste': jetons.accentContraste,
    '--couleur-accent-appui': jetons.accentAppui,
    '--couleur-accent-texte': jetons.accentTexte,
  };
}
