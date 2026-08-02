import { afterAll, describe, expect, it } from 'vitest';
import { TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { copierModeleVersSeminaire, ModeleInvalideError } from '../../src/lib/questionnaire/copier-modele';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinetEtSeminaire() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet copie-modèle' } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire cible',
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: 'PRESENTIEL',
      dureeHeures: 7,
      statut: 'PUBLIE',
    },
  });
  return { cabinet, seminaire };
}

async function creerModele(cabinetId: string) {
  const modele = await prisma.questionnaire.create({
    data: { cabinetId, estModele: true, nom: 'Modèle de test', titre: 'Évaluation' },
  });
  const section1 = await prisma.section.create({
    data: { questionnaireId: modele.id, titre: 'Général', ordre: 1 },
  });
  const section2 = await prisma.section.create({
    data: { questionnaireId: modele.id, titre: 'Logistique', ordre: 2 },
  });
  await prisma.question.create({
    data: {
      sectionId: section1.id,
      intitule: 'Satisfaction globale',
      type: TypeQuestion.NOTE_5,
      obligatoire: true,
      ordre: 1,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: section1.id,
      intitule: 'Qualité de la restauration',
      type: TypeQuestion.ECHELLE_4,
      autoriseSansOpinion: true,
      options: { libelles: { '1': 'Mauvaise', '2': 'Passable', '3': 'Bonne', '4': 'Excellente' } },
      ordre: 2,
    },
  });
  // Question logiquement supprimée du modèle : ne doit jamais être copiée.
  await prisma.question.create({
    data: {
      sectionId: section1.id,
      intitule: 'Ancienne question retirée',
      type: TypeQuestion.TEXTE_LIBRE,
      ordre: 3,
      supprimeLe: new Date(),
    },
  });
  await prisma.question.create({
    data: {
      sectionId: section2.id,
      intitule: 'Format préféré',
      type: TypeQuestion.QCM_UNIQUE,
      options: { choix: [{ id: 'a', libelle: 'Présentiel' }, { id: 'b', libelle: 'Distanciel' }] },
      ordre: 1,
    },
  });
  return modele;
}

describe('copierModeleVersSeminaire', () => {
  it('produit une structure identique (sections, questions, options, ordre), sans les questions supprimées, avec modeleOrigineId renseigné', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const modele = await creerModele(cabinet.id);

    const copie = await copierModeleVersSeminaire(modele.id, seminaire.id);

    expect(copie.estModele).toBe(false);
    expect(copie.seminaireId).toBe(seminaire.id);
    expect(copie.modeleOrigineId).toBe(modele.id);
    expect(copie.cabinetId).toBe(cabinet.id);

    const copieAvecStructure = await prisma.questionnaire.findUniqueOrThrow({
      where: { id: copie.id },
      include: { sections: { orderBy: { ordre: 'asc' }, include: { questions: { orderBy: { ordre: 'asc' } } } } },
    });

    expect(copieAvecStructure.sections).toHaveLength(2);
    expect(copieAvecStructure.sections[0]!.titre).toBe('Général');
    // La question supprimée du modèle n'est jamais copiée.
    expect(copieAvecStructure.sections[0]!.questions).toHaveLength(2);
    expect(copieAvecStructure.sections[0]!.questions.map((q) => q.intitule)).toEqual([
      'Satisfaction globale',
      'Qualité de la restauration',
    ]);
    expect(copieAvecStructure.sections[0]!.questions[1]!.autoriseSansOpinion).toBe(true);
    expect(copieAvecStructure.sections[0]!.questions[1]!.options).toEqual({
      libelles: { '1': 'Mauvaise', '2': 'Passable', '3': 'Bonne', '4': 'Excellente' },
    });
    expect(copieAvecStructure.sections[1]!.questions[0]!.options).toEqual({
      choix: [{ id: 'a', libelle: 'Présentiel' }, { id: 'b', libelle: 'Distanciel' }],
    });

    // Les ids sont neufs : ce n'est pas le même enregistrement que le modèle.
    expect(copieAvecStructure.id).not.toBe(modele.id);
    const sectionModele = await prisma.section.findFirstOrThrow({ where: { questionnaireId: modele.id, ordre: 1 } });
    expect(copieAvecStructure.sections[0]!.id).not.toBe(sectionModele.id);
  });

  it('refuse de copier un questionnaire qui n\'est pas un modèle', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const questionnaireSeminaire = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Pas un modèle' },
    });

    await expect(copierModeleVersSeminaire(questionnaireSeminaire.id, seminaire.id)).rejects.toThrow(
      ModeleInvalideError,
    );
  });

  it('refuse de copier un modèle vers un séminaire d\'un autre cabinet', async () => {
    const { cabinet: cabinetA } = await creerCabinetEtSeminaire();
    const { seminaire: seminaireB } = await creerCabinetEtSeminaire();
    const modele = await creerModele(cabinetA.id);

    await expect(copierModeleVersSeminaire(modele.id, seminaireB.id)).rejects.toThrow(ModeleInvalideError);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
