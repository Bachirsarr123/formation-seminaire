import { describe, expect, it } from 'vitest';
import { analyserFormulaireFormateur } from '../../src/lib/organisateur/formulaire-equipe';

function fd(entrees: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

const CHAMPS_VALIDES: [string, string][] = [
  ['nom', 'Camara'],
  ['prenom', 'Issa'],
  ['email', 'issa.camara@meridien-formation.test'],
];

describe('analyserFormulaireFormateur', () => {
  it('accepte un formulaire valide', () => {
    const resultat = analyserFormulaireFormateur(fd(CHAMPS_VALIDES));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toEqual({
      nom: 'Camara',
      prenom: 'Issa',
      email: 'issa.camara@meridien-formation.test',
    });
  });

  it('rejette un nom vide', () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'nom');
    expect(analyserFormulaireFormateur(fd(champs)).erreur).toBeTruthy();
  });

  it('rejette un prénom vide', () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'prenom');
    expect(analyserFormulaireFormateur(fd(champs)).erreur).toBeTruthy();
  });

  it("rejette l'absence d'e-mail — contrairement à un participant, il est obligatoire ici", () => {
    const champs = CHAMPS_VALIDES.filter(([k]) => k !== 'email');
    const resultat = analyserFormulaireFormateur(fd(champs));
    expect(resultat.erreur).toMatch(/e-mail/i);
  });

  it('rejette un e-mail mal formé', () => {
    const champs = CHAMPS_VALIDES.map(([k, v]): [string, string] => (k === 'email' ? [k, 'pas-un-email'] : [k, v]));
    expect(analyserFormulaireFormateur(fd(champs)).erreur).toBeTruthy();
  });

  it('normalise nom/prénom (espaces superflus) et l\'e-mail (casse)', () => {
    const resultat = analyserFormulaireFormateur(
      fd([
        ['nom', '  Camara  '],
        ['prenom', 'Issa   Modou'],
        ['email', 'Issa.Camara@Meridien-Formation.TEST'],
      ]),
    );
    expect(resultat.donnees?.nom).toBe('Camara');
    expect(resultat.donnees?.prenom).toBe('Issa Modou');
    expect(resultat.donnees?.email).toBe('issa.camara@meridien-formation.test');
  });
});
