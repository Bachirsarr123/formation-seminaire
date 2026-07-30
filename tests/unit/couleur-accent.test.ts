import { describe, expect, it } from 'vitest';
import { deriverJetonsAccent } from '../../src/lib/design/couleur-accent';

function luminanceRelative(hex: string): number {
  const entier = parseInt(hex.replace('#', ''), 16);
  const r = (entier >> 16) & 255;
  const g = (entier >> 8) & 255;
  const b = entier & 255;
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function ratioContraste(hexA: string, hexB: string): number {
  const lA = luminanceRelative(hexA);
  const lB = luminanceRelative(hexB);
  const [clair, sombre] = lA >= lB ? [lA, lB] : [lB, lA];
  return (clair + 0.05) / (sombre + 0.05);
}

const GRIS_000 = '#FAFBFC';

describe('deriverJetonsAccent — --couleur-accent-texte atteint 4,5:1, jamais l\'accent brut', () => {
  it.each([
    ['bleu foncé', '#0B3D91'],
    ['vert vif', '#16A34A'],
    ['orange', '#F97316'],
  ])('%s (%s) : accentTexte contraste ≥ 4.5:1 sur gris-000, et diffère de l\'accent brut si besoin', (_nom, hex) => {
    const jetons = deriverJetonsAccent(hex);

    expect(ratioContraste(jetons.accentTexte, GRIS_000)).toBeGreaterThanOrEqual(4.5);

    const contrasteAccentBrut = ratioContraste(hex, GRIS_000);
    if (contrasteAccentBrut < 4.5) {
      expect(jetons.accentTexte).not.toBe(hex.toUpperCase());
    }
  });

  it('accentContraste (texte sur bouton) choisit toujours le meilleur ratio', () => {
    const vert = deriverJetonsAccent('#16A34A');
    // Vert vif : gris-950 gagne largement (6.01 vs 3.30 calculés à la main).
    expect(vert.accentContraste).toBe('#0C0D10');

    const bleu = deriverJetonsAccent('#0B3D91');
    // Bleu foncé : blanc gagne largement (10.05 vs 1.97).
    expect(bleu.accentContraste).toBe('#FFFFFF');
  });

  it('couleur absente ou invalide retombe sur une valeur par défaut sûre', () => {
    const parDefaut = deriverJetonsAccent(null);
    expect(parDefaut.accent).toMatch(/^#[0-9A-F]{6}$/i);
    expect(ratioContraste(parDefaut.accentTexte, GRIS_000)).toBeGreaterThanOrEqual(4.5);

    const invalide = deriverJetonsAccent('pas-une-couleur');
    expect(invalide.accent).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
