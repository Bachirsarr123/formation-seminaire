import { describe, expect, it } from 'vitest';
import { analyserFormulaireModele } from '../../src/lib/organisateur/formulaire-questionnaire';

function fd(entrees: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

describe('analyserFormulaireModele', () => {
  it('accepte un formulaire valide', () => {
    const resultat = analyserFormulaireModele(fd([['nom', 'Évaluation standard'], ['titre', 'Votre avis compte']]));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toEqual({ nom: 'Évaluation standard', titre: 'Votre avis compte' });
  });

  it('rejette un nom vide', () => {
    expect(analyserFormulaireModele(fd([['nom', '  '], ['titre', 'Titre']])).erreur).toBeTruthy();
  });

  it('rejette un titre vide', () => {
    expect(analyserFormulaireModele(fd([['nom', 'Nom'], ['titre', '  ']])).erreur).toBeTruthy();
  });

  it('trim les champs', () => {
    const resultat = analyserFormulaireModele(fd([['nom', '  Nom  '], ['titre', '  Titre  ']]));
    expect(resultat.donnees).toEqual({ nom: 'Nom', titre: 'Titre' });
  });
});
