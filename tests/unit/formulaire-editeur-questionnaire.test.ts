import { describe, expect, it } from 'vitest';
import { analyserFormulaireQuestion, analyserFormulaireSection } from '../../src/lib/organisateur/formulaire-editeur-questionnaire';

function fd(entrees: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

describe('analyserFormulaireSection', () => {
  it('accepte un formulaire valide', () => {
    const resultat = analyserFormulaireSection(fd([['titre', 'Section 1'], ['description', 'Un peu de contexte']]));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toEqual({ titre: 'Section 1', description: 'Un peu de contexte' });
  });

  it('rejette un titre vide', () => {
    expect(analyserFormulaireSection(fd([['titre', '  ']])).erreur).toBeTruthy();
  });

  it('description absente devient null', () => {
    const resultat = analyserFormulaireSection(fd([['titre', 'Section 1']]));
    expect(resultat.donnees?.description).toBeNull();
  });
});

const CHAMPS_BASE: [string, string][] = [
  ['intitule', 'Satisfaction globale'],
  ['type', 'NOTE_5'],
];

describe('analyserFormulaireQuestion', () => {
  it('accepte une question à échelle simple, sans options', () => {
    const resultat = analyserFormulaireQuestion(fd(CHAMPS_BASE));
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees).toMatchObject({
      intitule: 'Satisfaction globale',
      type: 'NOTE_5',
      obligatoire: false,
      autoriseSansOpinion: false,
      moduleId: null,
      options: null,
    });
  });

  it('rejette un intitulé vide', () => {
    const champs = CHAMPS_BASE.filter(([k]) => k !== 'intitule');
    expect(analyserFormulaireQuestion(fd(champs)).erreur).toBeTruthy();
  });

  it('rejette un type invalide', () => {
    const champs = CHAMPS_BASE.map(([k, v]): [string, string] => (k === 'type' ? [k, 'TELEPORTATION'] : [k, v]));
    expect(analyserFormulaireQuestion(fd(champs)).erreur).toBeTruthy();
  });

  it('lit obligatoire/autoriseSansOpinion/moduleId', () => {
    const resultat = analyserFormulaireQuestion(
      fd([...CHAMPS_BASE, ['obligatoire', 'on'], ['autoriseSansOpinion', 'on'], ['moduleId', 'module-1']]),
    );
    expect(resultat.donnees).toMatchObject({ obligatoire: true, autoriseSansOpinion: true, moduleId: 'module-1' });
  });

  it('QCM : assemble les choix non vides, ignore les emplacements vides', () => {
    const resultat = analyserFormulaireQuestion(
      fd([
        ['intitule', 'Format préféré'],
        ['type', 'QCM_UNIQUE'],
        ['choixLibelle1', 'Présentiel'],
        ['choixLibelle2', 'Distanciel'],
        ['choixLibelle3', ''],
      ]),
    );
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees?.options).toEqual({
      choix: [
        { id: 'opt-1', libelle: 'Présentiel' },
        { id: 'opt-2', libelle: 'Distanciel' },
      ],
    });
  });

  it('QCM : rejette un seul choix renseigné (minimum deux)', () => {
    const resultat = analyserFormulaireQuestion(
      fd([['intitule', 'Format'], ['type', 'QCM_UNIQUE'], ['choixLibelle1', 'Seul choix']]),
    );
    expect(resultat.erreur).toBeTruthy();
  });

  it('ECHELLE_4 : exige les 4 niveaux', () => {
    const resultat = analyserFormulaireQuestion(
      fd([
        ['intitule', 'Logistique'],
        ['type', 'ECHELLE_4'],
        ['echelleLibelle1', 'Mauvaise'],
        ['echelleLibelle2', 'Passable'],
        ['echelleLibelle3', 'Bonne'],
        // niveau 4 manquant
      ]),
    );
    expect(resultat.erreur).toBeTruthy();
  });

  it('ECHELLE_4 : accepte les 4 niveaux et construit les libellés', () => {
    const resultat = analyserFormulaireQuestion(
      fd([
        ['intitule', 'Logistique'],
        ['type', 'ECHELLE_4'],
        ['echelleLibelle1', 'Mauvaise'],
        ['echelleLibelle2', 'Passable'],
        ['echelleLibelle3', 'Bonne'],
        ['echelleLibelle4', 'Excellente'],
      ]),
    );
    expect(resultat.erreur).toBeUndefined();
    expect(resultat.donnees?.options).toEqual({
      libelles: { '1': 'Mauvaise', '2': 'Passable', '3': 'Bonne', '4': 'Excellente' },
    });
  });

  it('TEXTE_LIBRE/OUI_NON/NPS : jamais d\'options', () => {
    for (const type of ['TEXTE_LIBRE', 'OUI_NON', 'NPS']) {
      const resultat = analyserFormulaireQuestion(fd([['intitule', 'Q'], ['type', type]]));
      expect(resultat.donnees?.options).toBeNull();
    }
  });
});
