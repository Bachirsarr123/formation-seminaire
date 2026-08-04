import { describe, expect, it } from 'vitest';
import { analyserFormulaireParticipant } from '../../src/lib/organisateur/formulaire-participant';

function fd(entrees: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

const CHAMPS_VALIDES: [string, string][] = [
  ['nom', 'Diop'],
  ['prenom', 'Awa'],
  ['email', 'awa.diop@x.sn'],
];

describe('analyserFormulaireParticipant', () => {
  it('accepte un formulaire minimal valide (email seul)', () => {
    const resultat = analyserFormulaireParticipant(fd(CHAMPS_VALIDES));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toMatchObject({
      nom: 'Diop',
      prenom: 'Awa',
      email: 'awa.diop@x.sn',
      telephone: null,
      fonction: null,
      organisation: null,
    });
  });

  it('accepte un téléphone valide seul, sans email', () => {
    const resultat = analyserFormulaireParticipant(
      fd([
        ['nom', 'Diop'],
        ['prenom', 'Awa'],
        ['telephone', '771234567'],
      ]),
    );
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees?.email).toBeNull();
    expect(resultat.donnees?.telephone).toBe('+221771234567');
  });

  it('rejette un nom vide', () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'nom');
    expect(analyserFormulaireParticipant(fd(champs)).erreur).toBeTruthy();
  });

  it('rejette un prénom vide', () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'prenom');
    expect(analyserFormulaireParticipant(fd(champs)).erreur).toBeTruthy();
  });

  it("rejette l'absence totale d'email et de téléphone", () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'email');
    const resultat = analyserFormulaireParticipant(fd(champs));
    expect(resultat.erreur).toMatch(/e-mail ou .* téléphone/i);
  });

  it('rejette un téléphone invalide même si présent, avec un message dédié', () => {
    const resultat = analyserFormulaireParticipant(
      fd([
        ['nom', 'Diop'],
        ['prenom', 'Awa'],
        ['telephone', '123'],
      ]),
    );
    expect(resultat.erreur).toMatch(/invalide/);
  });

  it('normalise nom/prénom (espaces superflus) et trim les champs optionnels', () => {
    const resultat = analyserFormulaireParticipant(
      fd([
        ['nom', '  Diop  '],
        ['prenom', 'Awa   Fatou'],
        ['email', 'Awa.Diop@X.SN'],
        ['fonction', '  Formatrice  '],
      ]),
    );
    expect(resultat.donnees?.nom).toBe('Diop');
    expect(resultat.donnees?.prenom).toBe('Awa Fatou');
    expect(resultat.donnees?.email).toBe('awa.diop@x.sn');
    expect(resultat.donnees?.fonction).toBe('Formatrice');
  });
});
