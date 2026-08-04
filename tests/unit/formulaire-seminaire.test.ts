import { describe, expect, it } from 'vitest';
import { analyserFormulaireSeminaire } from '../../src/lib/organisateur/formulaire-seminaire';

function fd(entrees: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

const CHAMPS_VALIDES: [string, string][] = [
  ['titre', 'Séminaire test'],
  ['dateDebut', '2026-09-01T09:00'],
  ['dateFin', '2026-09-01T17:00'],
  ['modalite', 'PRESENTIEL'],
  ['dureeHeures', '7'],
];

describe('analyserFormulaireSeminaire', () => {
  it('accepte un formulaire minimal valide', () => {
    const resultat = analyserFormulaireSeminaire(fd(CHAMPS_VALIDES));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toMatchObject({
      titre: 'Séminaire test',
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      capaciteMax: null,
      seuilAnonymat: 5,
      modules: [],
      formateurs: [],
    });
  });

  it('rejette un titre vide', () => {
    const resultat = analyserFormulaireSeminaire(fd([...CHAMPS_VALIDES.filter(([k]) => k !== 'titre'), ['titre', '  ']]));
    expect(resultat.erreur).toBeTruthy();
  });

  it('rejette une date de fin antérieure à la date de début', () => {
    const champs = CHAMPS_VALIDES.map(([k, v]): [string, string] =>
      k === 'dateFin' ? [k, '2026-08-31T09:00'] : [k, v],
    );
    const resultat = analyserFormulaireSeminaire(fd(champs));
    expect(resultat.erreur).toMatch(/postérieure/);
  });

  it('rejette une modalité inconnue', () => {
    const champs = CHAMPS_VALIDES.map(([k, v]): [string, string] => (k === 'modalite' ? [k, 'TELEPORTATION'] : [k, v]));
    expect(analyserFormulaireSeminaire(fd(champs)).erreur).toBeTruthy();
  });

  it('capacité vide devient null (illimitée), capacité négative refusée', () => {
    expect(analyserFormulaireSeminaire(fd(CHAMPS_VALIDES)).donnees!.capaciteMax).toBeNull();
    const resultat = analyserFormulaireSeminaire(fd([...CHAMPS_VALIDES, ['capaciteMax', '-5']]));
    expect(resultat.erreur).toBeTruthy();
  });

  it('assemble les modules depuis des tableaux parallèles, ignore les titres vides', () => {
    const resultat = analyserFormulaireSeminaire(
      fd([
        ...CHAMPS_VALIDES,
        ['moduleTitre', 'Module 1'],
        ['moduleDuree', '60'],
        ['moduleTitre', ''],
        ['moduleDuree', '30'],
        ['moduleTitre', 'Module 2'],
        ['moduleDuree', '45'],
      ]),
    );
    expect(resultat.donnees!.modules).toEqual([
      { titre: 'Module 1', dureeMinutes: 60, ordre: 1 },
      { titre: 'Module 2', dureeMinutes: 45, ordre: 2 },
    ]);
  });

  it('marque le formateur désigné comme PRINCIPAL, les autres INTERVENANT', () => {
    const resultat = analyserFormulaireSeminaire(
      fd([
        ...CHAMPS_VALIDES,
        ['formateurId', 'id-1'],
        ['formateurId', 'id-2'],
        ['formateurPrincipal', 'id-2'],
      ]),
    );
    expect(resultat.donnees!.formateurs).toEqual([
      { utilisateurId: 'id-1', roleFormateur: 'INTERVENANT' },
      { utilisateurId: 'id-2', roleFormateur: 'PRINCIPAL' },
    ]);
  });
});
