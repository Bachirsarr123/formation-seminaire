import { afterEach, describe, expect, it, vi } from 'vitest';
import { validerTextesConsentementProduction } from '../../src/lib/consentement/textes';

const VERSION = 'v-test';

function textes(dureeConservation: string) {
  return {
    [VERSION]: {
      INSCRIPTION_EVALUATION: { texte: 'texte', dureeConservation },
      COMMUNICATIONS: { texte: 'texte', dureeConservation },
      PARTAGE_EMPLOYEUR: { texte: 'texte', dureeConservation },
    },
  } as never;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('validerTextesConsentementProduction', () => {
  it("ne fait rien hors production, même si le texte est vide ou factice", () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(() => validerTextesConsentementProduction(textes(''), VERSION)).not.toThrow();
    expect(() =>
      validerTextesConsentementProduction(textes('[QA TEMPORAIRE — À RETIRER]'), VERSION),
    ).not.toThrow();
  });

  it('refuse de démarrer en production si le texte est vide', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => validerTextesConsentementProduction(textes(''), VERSION)).toThrow(/factice/);
  });

  it('refuse de démarrer en production si le texte porte le marqueur placeholder', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() =>
      validerTextesConsentementProduction(textes('[QA TEMPORAIRE — À RETIRER]'), VERSION),
    ).toThrow(/factice/);
  });

  it('démarre normalement en production si une vraie mention est renseignée', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() =>
      validerTextesConsentementProduction(textes('Conservées 3 ans après la fin du séminaire.'), VERSION),
    ).not.toThrow();
  });
});
