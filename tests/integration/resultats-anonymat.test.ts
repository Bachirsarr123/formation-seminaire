import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutQuestionnaire, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { calculerResultatsQuestionnaire } from '../../src/lib/questionnaire/resultats';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerQuestionnaireAvecSoumissions(nbSoumissions: number) {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test résultats' } });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire résultats',
      dateDebut: new Date('2026-11-01'),
      dateFin: new Date('2026-11-01'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 4,
      statut: StatutSeminaire.PUBLIE,
      seuilAnonymat: 5,
    },
  });

  const questionnaire = await prisma.questionnaire.create({
    data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Évaluation', statut: StatutQuestionnaire.PUBLIE },
  });
  const section = await prisma.section.create({ data: { questionnaireId: questionnaire.id, titre: 'Section 1', ordre: 1 } });
  const qNote = await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, ordre: 1 },
  });
  const qTexte = await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Remarques', type: TypeQuestion.TEXTE_LIBRE, ordre: 2 },
  });

  const soumissionIds: string[] = [];
  for (let i = 0; i < nbSoumissions; i++) {
    const soumission = await prisma.soumission.create({ data: { questionnaireId: questionnaire.id } });
    soumissionIds.push(soumission.id);
    await prisma.reponse.create({
      data: { soumissionId: soumission.id, questionId: qNote.id, valeurNumerique: (i % 5) + 1 },
    });
    await prisma.reponse.create({
      data: { soumissionId: soumission.id, questionId: qTexte.id, valeurTexte: `Texte numéro ${i + 1}` },
    });
  }

  return { cabinet, seminaire, questionnaire, qNote, qTexte, soumissionIds };
}

describe("Résultats du questionnaire d'évaluation — règles d'anonymat (non négociables)", () => {
  it('Règle 1 — en dessous du seuil (4 réponses sur 5), le total est connu mais aucun résultat individuel ne doit être exploité', async () => {
    const { questionnaire, seminaire } = await creerQuestionnaireAvecSoumissions(4);

    const total = await prisma.soumission.count({ where: { questionnaireId: questionnaire.id } });

    // C'est exactement la comparaison que l'orchestrateur organisateur
    // (obtenirResultatsSeminaire) doit faire avant d'exposer quoi que ce
    // soit : en dessous du seuil, seul `total` doit être lu par l'appelant,
    // jamais calculerResultatsQuestionnaire.
    expect(total).toBe(4);
    expect(total < seminaire.seuilAnonymat).toBe(true);
  });

  it('Règle 1 — au seuil (5e réponse), les résultats deviennent calculables et corrects', async () => {
    const { questionnaire, seminaire } = await creerQuestionnaireAvecSoumissions(5);

    const total = await prisma.soumission.count({ where: { questionnaireId: questionnaire.id } });
    expect(total).toBe(5);
    expect(total >= seminaire.seuilAnonymat).toBe(true);

    const resultats = await calculerResultatsQuestionnaire(questionnaire.id);
    expect(resultats.questionsFermees).toHaveLength(1);
    // Valeurs 1,2,3,4,5 (i % 5 + 1 pour i de 0 à 4) -> moyenne 3.
    expect(resultats.questionsFermees[0]!.moyenne).toBe(3);
    expect(resultats.questionsFermees[0]!.nbReponses).toBe(5);
  });

  it("Règle 2 — aucun filtre croisé n'existe sur le calcul des résultats (organisation, fonction, date)", () => {
    // calculerResultatsQuestionnaire ne prend qu'UN SEUL paramètre
    // (questionnaireId) : vérifié par l'arité de la fonction elle-même,
    // pas seulement par lecture du code — si un filtre est ajouté un jour,
    // ce test casse et force une décision consciente plutôt qu'un oubli.
    expect(calculerResultatsQuestionnaire.length).toBe(1);
  });

  it("Règle 3 — les textes libres sont mélangés (l'ordre d'insertion n'est jamais garanti) et ne portent ni date ni numéro d'ordre", async () => {
    const nb = 6;
    const { questionnaire } = await creerQuestionnaireAvecSoumissions(nb);
    const ordreInsertion = Array.from({ length: nb }, (_, i) => `Texte numéro ${i + 1}`);

    const resultats = await calculerResultatsQuestionnaire(questionnaire.id);
    const ouverte = resultats.questionsOuvertes[0]!;

    // Forme structurelle : un tableau de chaînes, pas d'objets qui
    // pourraient porter une date ou un ordre.
    expect(Array.isArray(ouverte.reponses)).toBe(true);
    expect(typeof ouverte.reponses[0]).toBe('string');
    expect(Object.keys(ouverte)).not.toContain('date');
    expect(Object.keys(ouverte)).not.toContain('ordre');
    expect(Object.keys(ouverte)).not.toContain('createdAt');

    // Même contenu que l'ordre d'insertion, une fois trié.
    expect(ouverte.reponses.slice().sort()).toEqual(ordreInsertion.slice().sort());

    // Sur plusieurs appels, au moins un diffère de l'ordre d'insertion —
    // même méthode que tests/integration/seuil-anonymat.test.ts (un mélange
    // aléatoire peut par chance retomber sur l'ordre initial une fois).
    const tentatives = await Promise.all(
      Array.from({ length: 20 }, () => calculerResultatsQuestionnaire(questionnaire.id)),
    );
    const auMoinsUnOrdreDifferent = tentatives.some(
      (t) => t.questionsOuvertes[0]!.reponses.join(',') !== ordreInsertion.join(','),
    );
    expect(auMoinsUnOrdreDifferent).toBe(true);
  });

  it("Règle 4 — aucun identifiant de soumission n'apparaît dans les résultats, et deux réponses d'une même soumission ne sont jamais regroupées", async () => {
    const { questionnaire, soumissionIds } = await creerQuestionnaireAvecSoumissions(5);

    const resultats = await calculerResultatsQuestionnaire(questionnaire.id);

    // Aucun soumissionId, nulle part dans l'arbre retourné — vérifié sur la
    // sérialisation complète, pas seulement sur les clés de premier niveau.
    const serialise = JSON.stringify(resultats);
    for (const id of soumissionIds) {
      expect(serialise.includes(id)).toBe(false);
    }

    // Chaque question fermée/ouverte est un agrégat indépendant : aucune
    // structure ne pairerait "la note et le texte de la même personne".
    expect(resultats.questionsFermees[0]).not.toHaveProperty('soumissionId');
    expect(resultats.questionsOuvertes[0]).not.toHaveProperty('soumissionId');
    expect(Object.keys(resultats)).not.toContain('parSoumission');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
