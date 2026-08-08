import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * "Les participants ne voient JAMAIS leurs notes dans l'espace participant"
 * (contrainte non négociable du lot notation) : vérifié en scannant
 * réellement le contenu des fichiers qui composent le parcours participant,
 * pas seulement en relisant le code — si une future modification importe
 * quoi que ce soit lié à la notation dans l'un de ces fichiers, ce test
 * casse immédiatement.
 */

const prisma = new PrismaClient();
const RACINE = path.resolve(__dirname, '../..');

const CHEMINS_PARTICIPANT = [
  'src/app/s',
  'src/app/mon-espace',
  'src/app/p',
  'src/lib/contexte-participant.ts',
  'src/lib/participant.ts',
  'src/lib/inscription.ts',
  'src/lib/inscription-publique.ts',
  'src/lib/soumission.ts',
  'src/lib/seminaire-public.ts',
];

function listerFichiers(cheminRelatif: string): string[] {
  const complet = path.join(RACINE, cheminRelatif);
  const info = statSync(complet);
  if (info.isFile()) return [complet];

  const resultats: string[] = [];
  for (const entree of readdirSync(complet)) {
    resultats.push(...listerFichiers(path.join(cheminRelatif, entree)));
  }
  return resultats;
}

describe('Notation formateur — confidentialité côté participant (non négociable)', () => {
  it("aucun fichier de l'espace participant ne référence la notation (mot « notation », import, requête)", () => {
    const fichiersSuspects: string[] = [];
    for (const chemin of CHEMINS_PARTICIPANT) {
      for (const fichier of listerFichiers(chemin)) {
        const contenu = readFileSync(fichier, 'utf8');
        if (/notation/i.test(contenu)) fichiersSuspects.push(path.relative(RACINE, fichier));
      }
    }
    expect(fichiersSuspects).toEqual([]);
  });

  it('les deux contraintes CHECK de la table notation existent bien en base', async () => {
    const contraintes = await prisma.$queryRaw<Array<{ conname: string; definition: string }>>(Prisma.sql`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'notation'::regclass AND contype = 'c'
    `);

    const noms = contraintes.map((c) => c.conname).sort();
    expect(noms).toEqual(['notation_justification_non_vide', 'notation_valeur_coherente'].sort());

    const justif = contraintes.find((c) => c.conname === 'notation_justification_non_vide')!;
    expect(justif.definition).toMatch(/btrim/i);

    const coherence = contraintes.find((c) => c.conname === 'notation_valeur_coherente')!;
    expect(coherence.definition).toMatch(/APPRECIATION/);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
