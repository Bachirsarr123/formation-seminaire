import { afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Règle 2 (non négociable) : le système sait qu'une personne a répondu,
 * jamais ce qu'elle a répondu. Aucune clé étrangère, colonne ou index ne
 * doit permettre de relier une ligne de `soumission`/`reponse` à une ligne
 * d'`inscription` ou de `participant`.
 *
 * Deux vérifications indépendantes, volontairement redondantes :
 *  1. le DMMF généré par Prisma à partir de schema.prisma ;
 *  2. pg_constraint sur la base réellement migrée — le DMMF ne verrait pas
 *     une FK ajoutée hors schema.prisma par une migration SQL manuelle.
 * La cloison doit être vraie dans les deux, pas seulement dans le code.
 */

const prisma = new PrismaClient();

const MODELES_CLOISONNES = ['Soumission', 'Reponse'] as const;
const TABLES_INTERDITES = ['inscription', 'participant'];
const MOTS_INTERDITS = /inscription|participant/i;

describe('Cloisonnement identité / réponses (Règle 2)', () => {
  it('le DMMF ne référence aucune relation ni colonne vers Inscription/Participant', () => {
    const { models } = Prisma.dmmf.datamodel;

    for (const nomModele of MODELES_CLOISONNES) {
      const modele = models.find((m) => m.name === nomModele);
      expect(modele, `modèle ${nomModele} introuvable dans le DMMF`).toBeDefined();

      for (const champ of modele!.fields) {
        if (champ.kind === 'object') {
          expect(
            ['Inscription', 'Participant'].includes(champ.type),
            `${nomModele}.${champ.name} est une relation vers ${champ.type}`,
          ).toBe(false);
        }

        expect(
          MOTS_INTERDITS.test(champ.name),
          `${nomModele}.${champ.name} porte un nom évoquant inscription/participant`,
        ).toBe(false);
      }
    }
  });

  it("aucune contrainte de clé étrangère en base ne relie soumission/reponse à inscription/participant", async () => {
    const contraintes = await prisma.$queryRaw<
      Array<{ table_source: string; table_cible: string; nom_contrainte: string }>
    >(Prisma.sql`
      SELECT
        conrelid::regclass::text  AS table_source,
        confrelid::regclass::text AS table_cible,
        conname                   AS nom_contrainte
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text  IN ('soumission', 'reponse')
        AND confrelid::regclass::text IN (${Prisma.join(TABLES_INTERDITES)})
    `);

    expect(contraintes).toEqual([]);
  });

  it('aucun index en base sur soumission/reponse ne porte sur une colonne inscription/participant', async () => {
    const indexSuspects = await prisma.$queryRaw<
      Array<{ table_name: string; index_name: string; column_name: string }>
    >(Prisma.sql`
      SELECT
        t.relname  AS table_name,
        i.relname  AS index_name,
        a.attname  AS column_name
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname IN ('soumission', 'reponse')
        AND a.attname ~* 'inscription|participant'
    `);

    expect(indexSuspects).toEqual([]);
  });

  it("la contrainte CHECK participant_contact_requis existe bien en base (email ou telephone requis)", async () => {
    // Un commentaire dans schema.prisma ne survit pas à un `db push` ou à un
    // baseline de migrations — seule une vérification en base le fait. Cette
    // contrainte n'est pas exprimable dans le DSL Prisma : elle est ajoutée à
    // la main dans le SQL de migration, donc particulièrement susceptible de
    // se perdre silencieusement lors d'une régénération.
    const contraintes = await prisma.$queryRaw<Array<{ conname: string; definition: string }>>(Prisma.sql`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'participant'::regclass
        AND contype = 'c'
        AND conname = 'participant_contact_requis'
    `);

    expect(contraintes).toHaveLength(1);
    expect(contraintes[0]!.definition).toMatch(/email IS NOT NULL/i);
    expect(contraintes[0]!.definition).toMatch(/telephone IS NOT NULL/i);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
