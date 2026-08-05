import { afterAll, describe, expect, it } from 'vitest';
import { TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { dupliquerQuestionnaire, QuestionnaireIntrouvableError } from '../../src/lib/questionnaire/dupliquer';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinetEtSeminaire(nom: string) {
  const cabinet = await prisma.cabinet.create({ data: { nom } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: `Séminaire ${nom}`,
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      statut: 'PUBLIE',
    },
  });
  return { cabinet, seminaire };
}

describe('dupliquerQuestionnaire', () => {
  it('duplique un modèle en un nouveau modèle (structure copiée, "(copie)" ajouté, modeleOrigineId reporté)', async () => {
    const { cabinet } = await creerCabinetEtSeminaire('Dupli modèle');
    const modele = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, estModele: true, nom: 'Modèle source', titre: 'Modèle source' },
    });
    const section = await prisma.section.create({ data: { questionnaireId: modele.id, titre: 'Section A', ordre: 1 } });
    await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Q1', type: TypeQuestion.NOTE_5, ordre: 1 },
    });
    // Question supprimée logiquement : ne doit jamais être copiée.
    await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Q supprimée', type: TypeQuestion.TEXTE_LIBRE, ordre: 2, supprimeLe: new Date() },
    });

    const copie = await dupliquerQuestionnaire(cabinet.id, modele.id);

    expect(copie.estModele).toBe(true);
    expect(copie.seminaireId).toBeNull();
    expect(copie.nom).toBe('Modèle source (copie)');
    expect(copie.titre).toBe('Modèle source (copie)');
    expect(copie.statut).toBe('BROUILLON');
    expect(copie.modeleOrigineId).toBeNull(); // la source elle-même n'avait pas d'origine.
    expect(copie.id).not.toBe(modele.id);

    const structure = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: copie.id },
      include: { sections: { include: { questions: true } } },
    });
    expect(structure.sections).toHaveLength(1);
    expect(structure.sections[0]!.questions).toHaveLength(1);
    expect(structure.sections[0]!.questions[0]!.intitule).toBe('Q1');
  });

  it("duplique le questionnaire verrouillé d'un séminaire en un nouveau questionnaire attaché au MÊME séminaire, moduleId reporté", async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire('Dupli séminaire');
    const modele = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, estModele: true, nom: 'Modèle', titre: 'Modèle' },
    });
    const module_ = await prisma.module.create({
      data: { seminaireId: seminaire.id, titre: 'Module 1', dureeMinutes: 60, ordre: 1 },
    });
    const questionnaireSeminaire = await prisma.questionnaire.create({
      data: {
        cabinetId: cabinet.id,
        seminaireId: seminaire.id,
        modeleOrigineId: modele.id,
        titre: 'Évaluation du séminaire',
        statut: 'PUBLIE', // simule un questionnaire déjà verrouillé (peu importe ici, dupliquer n'exige pas le verrouillage)
      },
    });
    const section = await prisma.section.create({
      data: { questionnaireId: questionnaireSeminaire.id, titre: 'Section', ordre: 1 },
    });
    await prisma.question.create({
      data: {
        sectionId: section.id,
        intitule: 'Satisfaction',
        type: TypeQuestion.NOTE_5,
        ordre: 1,
        moduleId: module_.id,
      },
    });

    const copie = await dupliquerQuestionnaire(cabinet.id, questionnaireSeminaire.id);

    expect(copie.estModele).toBe(false);
    expect(copie.seminaireId).toBe(seminaire.id);
    expect(copie.nom).toBeNull();
    expect(copie.titre).toBe('Évaluation du séminaire (copie)');
    expect(copie.statut).toBe('BROUILLON');
    // Reporte le modeleOrigineId de la SOURCE (le modèle d'origine réel),
    // pas l'id de la source elle-même — préserve le groupe de comparaison.
    expect(copie.modeleOrigineId).toBe(modele.id);

    const structure = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: copie.id },
      include: { sections: { include: { questions: true } } },
    });
    expect(structure.sections[0]!.questions[0]!.moduleId).toBe(module_.id);
  });

  it("refuse de dupliquer un questionnaire d'un autre cabinet", async () => {
    const { cabinet: cabinetA } = await creerCabinetEtSeminaire('Dupli isolation A');
    const { cabinet: cabinetB } = await creerCabinetEtSeminaire('Dupli isolation B');
    const modeleA = await prisma.questionnaire.create({
      data: { cabinetId: cabinetA.id, estModele: true, nom: 'Modèle A', titre: 'Modèle A' },
    });

    await expect(dupliquerQuestionnaire(cabinetB.id, modeleA.id)).rejects.toThrow(QuestionnaireIntrouvableError);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
