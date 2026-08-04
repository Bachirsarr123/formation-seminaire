import { describe, expect, it } from 'vitest';
import {
  analyserLignesCsv,
  decoderContenuCsv,
  detecterDelimiteur,
  mapperEntetes,
} from '../../src/lib/organisateur/import-participants';

describe('decoderContenuCsv', () => {
  it('décode un contenu UTF-8 valide tel quel', () => {
    const buffer = Buffer.from('Nom;Prénom\nDiop;Awa', 'utf-8');
    expect(decoderContenuCsv(buffer)).toBe('Nom;Prénom\nDiop;Awa');
  });

  it('bascule en Windows-1252 pour un octet seul de la plage 0xA0-0xFF (accent classique)', () => {
    // "café" en Windows-1252 : c, a, f, é(0xE9) — un 0xE9 isolé n'est jamais
    // une séquence UTF-8 valide, ce qui déclenche le repli.
    const buffer = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
    expect(decoderContenuCsv(buffer)).toBe('café');
  });

  it('décode correctement les octets 0x80-0x9F spécifiques à Windows-1252 (œ, tiret cadratin)', () => {
    // "cœur — test" : œ = 0x9c, tiret cadratin (—) = 0x97 en Windows-1252 —
    // ces deux points de code diffèrent de Latin-1, qui a des caractères de
    // contrôle C1 à ces positions.
    const buffer = Buffer.from([
      0x63, 0x9c, 0x75, 0x72, // "cœur"
      0x20, 0x97, 0x20, // " — "
      0x74, 0x65, 0x73, 0x74, // "test"
    ]);
    expect(decoderContenuCsv(buffer)).toBe('cœur — test');
  });
});

describe('detecterDelimiteur', () => {
  it('détecte le point-virgule (export Excel-FR)', () => {
    expect(detecterDelimiteur('Nom;Prénom;Email\nDiop;Awa;awa@x.sn')).toBe(';');
  });

  it('détecte la virgule quand elle domine', () => {
    expect(detecterDelimiteur('Nom,Prenom,Email\nDiop,Awa,awa@x.sn')).toBe(',');
  });
});

describe('analyserLignesCsv', () => {
  it('parse des lignes simples séparées par point-virgule', () => {
    const lignes = analyserLignesCsv('Nom;Prenom\nDiop;Awa\nFall;Ibra', ';');
    expect(lignes).toEqual([
      ['Nom', 'Prenom'],
      ['Diop', 'Awa'],
      ['Fall', 'Ibra'],
    ]);
  });

  it('gère un champ entre guillemets contenant le délimiteur', () => {
    const lignes = analyserLignesCsv('Nom;Organisation\nDiop;"Dupont, SARL"', ';');
    expect(lignes).toEqual([
      ['Nom', 'Organisation'],
      ['Diop', 'Dupont, SARL'],
    ]);
  });

  it('gère un guillemet échappé (doublé) à l\'intérieur d\'un champ entre guillemets', () => {
    const lignes = analyserLignesCsv('Nom\n"L\'équipe ""officielle"""', ';');
    expect(lignes[1]).toEqual(['L\'équipe "officielle"']);
  });

  it('gère un champ multi-lignes entre guillemets', () => {
    const lignes = analyserLignesCsv('Nom;Notes\nDiop;"ligne 1\nligne 2"\nFall;RAS', ';');
    expect(lignes).toEqual([
      ['Nom', 'Notes'],
      ['Diop', 'ligne 1\nligne 2'],
      ['Fall', 'RAS'],
    ]);
  });

  it('ignore les lignes vides finales', () => {
    const lignes = analyserLignesCsv('Nom;Prenom\nDiop;Awa\n\n', ';');
    expect(lignes).toEqual([
      ['Nom', 'Prenom'],
      ['Diop', 'Awa'],
    ]);
  });
});

describe('mapperEntetes', () => {
  it('reconnaît les en-têtes accentués, insensibles à la casse', () => {
    const resultat = mapperEntetes(['NOM', 'Prénom', 'Email', 'Téléphone', 'Fonction', 'Organisation']);
    expect('erreur' in resultat).toBe(false);
    if (!('erreur' in resultat)) {
      expect(resultat.colonnes).toMatchObject({ nom: 0, prenom: 1, email: 2, telephone: 3, fonction: 4, organisation: 5 });
    }
  });

  it('reconnaît les alias courriel/tel/entreprise', () => {
    const resultat = mapperEntetes(['nom', 'prenom', 'courriel', 'tel', 'entreprise']);
    expect('erreur' in resultat).toBe(false);
    if (!('erreur' in resultat)) {
      expect(resultat.colonnes).toMatchObject({ nom: 0, prenom: 1, email: 2, telephone: 3, organisation: 4 });
    }
  });

  it("rejette un fichier sans colonne Nom ou Prénom", () => {
    const resultat = mapperEntetes(['Email', 'Téléphone']);
    expect('erreur' in resultat).toBe(true);
  });
});
