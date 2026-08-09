import { describe, expect, it } from 'vitest';
import { construireOrigineRequete } from '../../src/lib/origine-requete';

describe('construireOrigineRequete', () => {
  it('préfère x-forwarded-host/-proto (derrière un proxy comme Render)', () => {
    const enTetes = new Headers({
      'x-forwarded-host': 'seminaire-demo.onrender.com',
      'x-forwarded-proto': 'https',
      host: 'localhost:3000',
    });

    expect(construireOrigineRequete(enTetes)).toBe('https://seminaire-demo.onrender.com');
  });

  it('retombe sur host quand x-forwarded-host est absent (local, pas de proxy)', () => {
    const enTetes = new Headers({ host: 'localhost:3000' });

    expect(construireOrigineRequete(enTetes)).toBe('https://localhost:3000');
  });

  it('retombe sur https par défaut quand x-forwarded-proto est absent', () => {
    const enTetes = new Headers({ 'x-forwarded-host': 'exemple.test' });

    expect(construireOrigineRequete(enTetes)).toBe('https://exemple.test');
  });
});
