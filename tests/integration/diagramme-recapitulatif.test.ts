import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutQuestionnaire, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { calculerResultatsQuestionnaire } from '../../src/lib/questionnaire/resultats';

// moyennePourcentage alimente le diagramme récapitulatif (bas de la page
// résultats, src/components/diagramme-recapitulatif.tsx) : une moyenne
// ramenée sur 0-100 selon les bornes propres à chaque type de question, pour
// pouvoir comparer des questions notées sur des échelles différentes.
describe("calculerResultatsQuestionnaire — moyennePourcentage (diagramme récapitulatif)", () => {
  it('normalise chaque type de question notée sur sa propre échelle, et laisse null pour un QCM (pas de moyenne)', async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test diagramme récapitulatif' } });
    const seminaire = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire diagramme récapitulatif',
        dateDebut: new Date('2026-11-01'),
        dateFin: new Date('2026-11-01'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 4,
        statut: StatutSeminaire.EN_COURS,
      },
    });
    const questionnaire = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, seminaireId: seminaire.id, titre: 'Évaluation', statut: StatutQuestionnaire.PUBLIE },
    });
    const section = await prisma.section.create({ data: { questionnaireId: questionnaire.id, titre: 'S1', ordre: 1 } });

    // NOTE_10 (1-10) : moyenne 10 -> 100 %.
    const qNote10 = await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Note sur 10', type: TypeQuestion.NOTE_10, ordre: 1 },
    });
    // OUI_NON (0-1) : moyenne 0 (tout le monde a répondu Non) -> 0 %.
    const qOuiNon = await prisma.question.create({
      data: { sectionId: section.id, intitule: 'Oui ou non', type: TypeQuestion.OUI_NON, ordre: 2 },
    });
    // QCM_UNIQUE : pas de moyenne numérique possible.
    const qQcm = await prisma.question.create({
      data: {
        sectionId: section.id,
        intitule: 'Choix unique',
        type: TypeQuestion.QCM_UNIQUE,
        ordre: 3,
        options: { choix: [{ id: 'a', libelle: 'A' }, { id: 'b', libelle: 'B' }] },
      },
    });

    const soumission = await prisma.soumission.create({ data: { questionnaireId: questionnaire.id } });
    await prisma.reponse.create({ data: { soumissionId: soumission.id, questionId: qNote10.id, valeurNumerique: 10 } });
    await prisma.reponse.create({ data: { soumissionId: soumission.id, questionId: qOuiNon.id, valeurNumerique: 0 } });
    await prisma.reponse.create({
      data: { soumissionId: soumission.id, questionId: qQcm.id, valeurOptions: { choix: ['a'] } },
    });

    const resultats = await calculerResultatsQuestionnaire(questionnaire.id);
    const parId = new Map(resultats.questionsFermees.map((q) => [q.questionId, q]));

    expect(parId.get(qNote10.id)?.moyennePourcentage).toBe(100);
    expect(parId.get(qOuiNon.id)?.moyennePourcentage).toBe(0);
    expect(parId.get(qQcm.id)?.moyennePourcentage).toBeNull();
    expect(parId.get(qQcm.id)?.moyenne).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
