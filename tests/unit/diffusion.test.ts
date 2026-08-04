import { describe, expect, it } from 'vitest';
import { construireLienPublicSeminaire, genererTexteInvitation } from '../../src/lib/organisateur/diffusion';

describe('construireLienPublicSeminaire', () => {
  it('assemble origine et code public sous /s/', () => {
    expect(construireLienPublicSeminaire('https://exemple.test', 'abc123xyz9')).toBe(
      'https://exemple.test/s/abc123xyz9',
    );
  });
});

describe('genererTexteInvitation', () => {
  const SEMINAIRE_PRESENTIEL = {
    titre: 'Atelier gouvernance',
    dateDebut: new Date('2026-09-10T09:00:00Z'),
    lieu: 'Dakar',
    modalite: 'PRESENTIEL' as const,
  };

  it('inclut le titre, la date, le lieu et le lien', () => {
    const texte = genererTexteInvitation(SEMINAIRE_PRESENTIEL, 'https://exemple.test/s/abc');

    expect(texte).toContain('Atelier gouvernance');
    expect(texte).toContain('Dakar');
    expect(texte).toContain('https://exemple.test/s/abc');
  });

  it('omet la parenthèse de lieu quand aucun lieu n\'est renseigné', () => {
    const texte = genererTexteInvitation({ ...SEMINAIRE_PRESENTIEL, lieu: null }, 'https://exemple.test/s/abc');

    expect(texte).not.toContain('()');
  });

  it('affiche "en ligne" pour un séminaire distanciel, même si un lieu est renseigné', () => {
    const texte = genererTexteInvitation(
      { ...SEMINAIRE_PRESENTIEL, modalite: 'DISTANCIEL', lieu: 'Salle jamais utilisée' },
      'https://exemple.test/s/abc',
    );

    expect(texte).toContain('en ligne');
    expect(texte).not.toContain('Salle jamais utilisée');
  });
});
