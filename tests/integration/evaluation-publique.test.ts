import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutQuestionnaire, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { obtenirOuCreerLienEvaluation } from '../../src/lib/organisateur/lien-evaluation';
import { chargerEvaluationPublique, soumettreReponseEvaluationPublique } from '../../src/lib/questionnaire/public';

async function creerCabinetEtSeminaire() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test évaluation publique' } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire évaluation publique',
      dateDebut: new Date('2026-11-01'),
      dateFin: new Date('2026-11-01'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 4,
      statut: StatutSeminaire.EN_COURS,
    },
  });
  return { cabinet, seminaire };
}

async function publierQuestionnaireAvecQuestion(cabinetId: string, seminaireId: string, dateLimite: Date | null = null) {
  const questionnaire = await prisma.questionnaire.create({
    data: { cabinetId, seminaireId, titre: 'Évaluation', statut: StatutQuestionnaire.PUBLIE, dateLimite },
  });
  const section = await prisma.section.create({ data: { questionnaireId: questionnaire.id, titre: 'Section 1', ordre: 1 } });
  const question = await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, ordre: 1 },
  });
  return { questionnaire, section, question };
}

describe("Lien public de l'évaluation à chaud (/e/{codeAcces}) — même principe que le recueil de besoins", () => {
  it('génère un code au premier appel, puis renvoie toujours le même (idempotent)', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();

    const premier = await obtenirOuCreerLienEvaluation(cabinet.id, seminaire.id);
    expect(premier).not.toBeNull();

    const deuxieme = await obtenirOuCreerLienEvaluation(cabinet.id, seminaire.id);
    expect(deuxieme).toBe(premier);

    const enBase = await prisma.seminaire.findUniqueOrThrow({ where: { id: seminaire.id }, select: { codeAccesEvaluation: true } });
    expect(enBase.codeAccesEvaluation).toBe(premier);
  });

  it("renvoie null pour un séminaire d'un autre cabinet ou inexistant (règle B)", async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    const { cabinet: autreCabinet } = await creerCabinetEtSeminaire();

    expect(await obtenirOuCreerLienEvaluation(autreCabinet.id, seminaire.id)).toBeNull();
    expect(await obtenirOuCreerLienEvaluation(autreCabinet.id, 'inexistant')).toBeNull();
  });

  it('un code inconnu ne charge rien', async () => {
    expect(await chargerEvaluationPublique('code-inexistant')).toBeNull();
  });

  it("indique que le questionnaire n'est pas encore disponible tant qu'aucun n'est publié", async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const codeAcces = await obtenirOuCreerLienEvaluation(cabinet.id, seminaire.id);

    const evaluation = await chargerEvaluationPublique(codeAcces!);
    expect(evaluation).not.toBeNull();
    expect(evaluation!.questionnaire).toBeNull();
    expect(evaluation!.messageIndisponible).toMatch(/pas encore disponible/);
  });

  it('charge le questionnaire publié avec ses sections/questions une fois le lien généré', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const { questionnaire, question } = await publierQuestionnaireAvecQuestion(cabinet.id, seminaire.id);
    const codeAcces = await obtenirOuCreerLienEvaluation(cabinet.id, seminaire.id);

    const evaluation = await chargerEvaluationPublique(codeAcces!);
    expect(evaluation!.questionnaire?.id).toBe(questionnaire.id);
    expect(evaluation!.questionnaire?.sections[0]?.questions[0]?.id).toBe(question.id);
    expect(evaluation!.messageIndisponible).toBeNull();
  });

  it('signale un questionnaire dont le délai de réponse est dépassé, sans exposer ses questions', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    await publierQuestionnaireAvecQuestion(cabinet.id, seminaire.id, new Date('2020-01-01'));
    const codeAcces = await obtenirOuCreerLienEvaluation(cabinet.id, seminaire.id);

    const evaluation = await chargerEvaluationPublique(codeAcces!);
    expect(evaluation!.questionnaire).toBeNull();
    expect(evaluation!.messageIndisponible).toMatch(/délai/);
  });

  it('une soumission publique crée une réponse, sans aucun lien vers une identité — et deux soumissions successives sont indépendantes (pas de suivi par personne)', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const { questionnaire, question } = await publierQuestionnaireAvecQuestion(cabinet.id, seminaire.id);

    await soumettreReponseEvaluationPublique(questionnaire.id, [{ questionId: question.id, valeurNumerique: 4 }]);
    await soumettreReponseEvaluationPublique(questionnaire.id, [{ questionId: question.id, valeurNumerique: 2 }]);

    const total = await prisma.soumission.count({ where: { questionnaireId: questionnaire.id } });
    expect(total).toBe(2);

    const soumissions = await prisma.soumission.findMany({ where: { questionnaireId: questionnaire.id } });
    for (const s of soumissions) {
      expect(Object.keys(s)).not.toContain('participantId');
      expect(Object.keys(s)).not.toContain('inscriptionId');
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
