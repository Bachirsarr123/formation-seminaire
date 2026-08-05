import { afterAll, describe, expect, it } from 'vitest';
import { TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { archiverModele, creerModele, listerModeles } from '../../src/lib/organisateur/questionnaires';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinet(nom: string) {
  return prisma.cabinet.create({ data: { nom } });
}

async function creerSeminaire(cabinetId: string, titre: string) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre,
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      statut: 'PUBLIE',
    },
  });
}

describe('creerModele', () => {
  it('crée un modèle en BROUILLON, sans séminaire', async () => {
    const cabinet = await creerCabinet('Cabinet questionnaires — création');

    const modele = await creerModele(cabinet.id, { nom: 'Modèle A', titre: 'Titre A' });

    expect(modele.estModele).toBe(true);
    expect(modele.seminaireId).toBeNull();
    expect(modele.statut).toBe('BROUILLON');
    expect(modele.cabinetId).toBe(cabinet.id);
  });
});

describe('listerModeles', () => {
  it('compte les questions non supprimées et les séminaires DISTINCTS (une même séminaire, deux questionnaires du même modèle, compte une fois)', async () => {
    const cabinet = await creerCabinet('Cabinet questionnaires — comptes');
    const modele = await creerModele(cabinet.id, { nom: 'Modèle compté', titre: 'Titre' });
    const section = await prisma.section.create({ data: { questionnaireId: modele.id, titre: 'S1', ordre: 1 } });
    await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Q1', type: TypeQuestion.NOTE_5, ordre: 1 },
    });
    await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Q2', type: TypeQuestion.TEXTE_LIBRE, ordre: 2 },
    });
    // Question supprimée logiquement : ne doit jamais être comptée.
    await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Q supprimée', type: TypeQuestion.TEXTE_LIBRE, ordre: 3, supprimeLe: new Date() },
    });

    const seminaire = await creerSeminaire(cabinet.id, 'Séminaire compté');
    // Deux questionnaires du séminaire issus du MÊME modèle (cas
    // "dupliquer après verrouillage") : ne doit compter qu'UN séminaire.
    await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, seminaireId: seminaire.id, modeleOrigineId: modele.id, titre: 'Ancien (verrouillé)' },
    });
    await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, seminaireId: seminaire.id, modeleOrigineId: modele.id, titre: 'Nouveau' },
    });

    const liste = await listerModeles(cabinet.id);
    const entree = liste.find((m) => m.id === modele.id);

    expect(entree).toBeDefined();
    expect(entree!.nbQuestions).toBe(2);
    expect(entree!.nbSeminaires).toBe(1);
  });

  it("ne retourne jamais un modèle d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet('Cabinet questionnaires — isolation A');
    const cabinetB = await creerCabinet('Cabinet questionnaires — isolation B');
    const modeleA = await creerModele(cabinetA.id, { nom: 'Modèle A', titre: 'Titre A' });
    const modeleB = await creerModele(cabinetB.id, { nom: 'Modèle B', titre: 'Titre B' });

    const listeA = await listerModeles(cabinetA.id);

    expect(listeA.map((m) => m.id)).toContain(modeleA.id);
    expect(listeA.map((m) => m.id)).not.toContain(modeleB.id);
  });

  it('exclut les modèles archivés (supprimeLe)', async () => {
    const cabinet = await creerCabinet('Cabinet questionnaires — archivage');
    const modele = await creerModele(cabinet.id, { nom: 'À archiver', titre: 'Titre' });

    expect((await listerModeles(cabinet.id)).map((m) => m.id)).toContain(modele.id);

    await archiverModele(cabinet.id, modele.id);

    expect((await listerModeles(cabinet.id)).map((m) => m.id)).not.toContain(modele.id);
    // Suppression LOGIQUE uniquement : la ligne existe toujours en base.
    const relu = await prisma.questionnaire.findUniqueOrThrow({ where: { id: modele.id } });
    expect(relu.supprimeLe).not.toBeNull();
  });
});

describe('archiverModele — isolation', () => {
  it("n'archive jamais un modèle d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet('Cabinet questionnaires — archivage isolation A');
    const cabinetB = await creerCabinet('Cabinet questionnaires — archivage isolation B');
    const modeleB = await creerModele(cabinetB.id, { nom: 'Modèle B', titre: 'Titre B' });

    expect(await archiverModele(cabinetA.id, modeleB.id)).toBe(false);
    const relu = await prisma.questionnaire.findUniqueOrThrow({ where: { id: modeleB.id } });
    expect(relu.supprimeLe).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
