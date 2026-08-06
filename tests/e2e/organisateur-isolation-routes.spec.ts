import { test, expect } from '@playwright/test';
import { Modalite, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

/**
 * Checklist étape 8 (durcissement, point 3) : une entrée par route [id] de
 * l'espace organisateur, pas seulement par fonction de lib/ — une route
 * oubliée ici est précisément celle qui fuitera. Ajouter une future route
 * cabinet-scopée à cette liste doit être une ligne, pas un nouveau test.
 *
 * Le volet "écriture" (Server Actions mutantes : modifier, supprimer,
 * changer de statut, dupliquer, ajouter un participant, importer) est
 * couvert séparément dans tests/integration/organisateur-isolation.test.ts
 * — au niveau lib, la seule unité de test possible pour une Server Action
 * (elle dépend de cookies()/next/headers, indisponible hors d'une vraie
 * requête Next.js). Ce fichier-ci ne couvre que la lecture (GET), au niveau
 * route HTTP réelle.
 */
const ROUTES_ID: { nom: string; chemin: (id: string) => string }[] = [
  { nom: 'fiche séminaire', chemin: (id) => `/organisateur/seminaires/${id}` },
  { nom: 'modifier', chemin: (id) => `/organisateur/seminaires/${id}/modifier` },
  { nom: 'participants', chemin: (id) => `/organisateur/seminaires/${id}/participants` },
  { nom: 'export participants', chemin: (id) => `/organisateur/seminaires/${id}/participants/export` },
  { nom: 'import participants', chemin: (id) => `/organisateur/seminaires/${id}/participants/import` },
  { nom: 'QR PNG (diffusion, étape 9)', chemin: (id) => `/organisateur/seminaires/${id}/qr.png` },
  { nom: 'QR SVG (diffusion, étape 9)', chemin: (id) => `/organisateur/seminaires/${id}/qr.svg` },
  { nom: 'choisir un modèle de questionnaire (étape 13, lot 5)', chemin: (id) => `/organisateur/seminaires/${id}/questionnaire/choisir-modele` },
];

// Même principe que ROUTES_ID, mais pour les routes clées par l'id d'un
// QUESTIONNAIRE (pas d'un séminaire) — bibliothèque de modèles et éditeur,
// lot 5 parties A. Fixture dédiée plus bas : un modèle du cabinet B avec une
// question, pour que la route "modifier une question" ait aussi un id de
// question valide à tester.
const ROUTES_QUESTIONNAIRE_ID: { nom: string; chemin: (questionnaireId: string, questionId: string) => string }[] = [
  { nom: 'éditeur (étape 12)', chemin: (id) => `/organisateur/questionnaires/${id}` },
  { nom: 'aperçu (étape 13)', chemin: (id) => `/organisateur/questionnaires/${id}/apercu` },
  { nom: 'modifier une question (étape 12)', chemin: (id, questionId) => `/organisateur/questionnaires/${id}/questions/${questionId}/modifier` },
];

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/organisateur/connexion');
  await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
}

test.describe("Isolation par route — un organisateur du cabinet A ne peut jamais atteindre une ressource du cabinet B", () => {
  let cabinetBId: string;
  let seminaireBId: string;

  test.beforeAll(async () => {
    const cabinetB = await prisma.cabinet.create({ data: { nom: `Cabinet e2e isolation routes ${Date.now()}` } });
    const seminaireB = await prisma.seminaire.create({
      data: {
        cabinetId: cabinetB.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire du cabinet B (isolation routes)',
        dateDebut: new Date('2026-11-01T09:00:00Z'),
        dateFin: new Date('2026-11-01T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    cabinetBId = cabinetB.id;
    seminaireBId = seminaireB.id;
  });

  test.afterAll(async () => {
    await prisma.seminaire.delete({ where: { id: seminaireBId } });
    await prisma.cabinet.delete({ where: { id: cabinetBId } });
  });

  for (const route of ROUTES_ID) {
    test(`${route.nom} : 404 sur une ressource du cabinet B, jamais 403`, async ({ page }) => {
      await connecter(page);

      // Statut HTTP directement, pas un texte affiché : "export" est un
      // Route Handler qui renvoie un JSON 404 (pas la page "introuvable" de
      // Next), les autres sont des pages. Vérifier le code plutôt que le
      // texte couvre les deux uniformément, et confirme aussi "jamais 403"
      // sans dépendre du rendu exact de chaque cas.
      const reponse = await page.goto(route.chemin(seminaireBId));
      expect(reponse?.status(), `${route.nom} devrait répondre 404`).toBe(404);
    });
  }
});

test.describe("Isolation par route (questionnaires, lot 5) — un organisateur du cabinet A ne peut jamais atteindre le questionnaire d'un cabinet B", () => {
  let cabinetBId: string;
  let questionnaireBId: string;
  let questionBId: string;

  test.beforeAll(async () => {
    const cabinetB = await prisma.cabinet.create({ data: { nom: `Cabinet e2e isolation questionnaires ${Date.now()}` } });
    const modeleB = await prisma.questionnaire.create({
      data: { cabinetId: cabinetB.id, estModele: true, nom: 'Modèle B (isolation routes)', titre: 'Modèle B' },
    });
    const sectionB = await prisma.section.create({ data: { questionnaireId: modeleB.id, titre: 'Section B', ordre: 1 } });
    const questionB = await prisma.question.create({
      data: { sectionId: sectionB.id, intitule: 'Question B', type: TypeQuestion.TEXTE_LIBRE, ordre: 1 },
    });
    cabinetBId = cabinetB.id;
    questionnaireBId = modeleB.id;
    questionBId = questionB.id;
  });

  test.afterAll(async () => {
    await prisma.section.deleteMany({ where: { questionnaireId: questionnaireBId } });
    await prisma.questionnaire.delete({ where: { id: questionnaireBId } });
    await prisma.cabinet.delete({ where: { id: cabinetBId } });
  });

  for (const route of ROUTES_QUESTIONNAIRE_ID) {
    test(`${route.nom} : 404 sur un questionnaire du cabinet B, jamais 403`, async ({ page }) => {
      await connecter(page);
      const reponse = await page.goto(route.chemin(questionnaireBId, questionBId));
      expect(reponse?.status(), `${route.nom} devrait répondre 404`).toBe(404);
    });
  }
});
