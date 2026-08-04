import { test, expect, type Page } from '@playwright/test';
import { Modalite, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire, genererJetonInscription } from '../../src/lib/jeton';
import {
  creerInscriptionAnnulee,
  creerSeminaireOuvert,
  supprimerCabinetCompletement,
  type SeminaireOuvertFixture,
} from './creer-fixtures';
import { ipFactice } from './fixtures';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

async function verifierAucunDebordementHorizontal(page: Page, etape: string) {
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(debordement, `débordement horizontal détecté (${etape})`).toBe(false);
}

async function appliquerZoom200(page: Page) {
  // CSS `zoom` (non standard mais supporté par Chromium) : la façon la plus
  // fidèle de simuler un vrai zoom navigateur (Ctrl +) plutôt que de changer
  // la taille du viewport, qui est une opération différente.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('zoom', '2');
  });
}

test.describe('320px de large, avec et sans zoom 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  let fixture: SeminaireOuvertFixture;
  let jetonAnnule: string;

  test.beforeAll(async () => {
    fixture = await creerSeminaireOuvert();
    ({ jeton: jetonAnnule } = await creerInscriptionAnnulee(fixture));
  });

  test.afterAll(async () => {
    await supprimerCabinetCompletement(fixture.cabinetId);
  });

  test('page publique du séminaire', async ({ page }) => {
    await page.goto(`/s/${fixture.codePublic}`);
    await verifierAucunDebordementHorizontal(page, 'page publique, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'page publique, 200%');
  });

  test("formulaire d'inscription", async ({ page }) => {
    await page.goto(`/s/${fixture.codePublic}/inscription`);
    await verifierAucunDebordementHorizontal(page, 'formulaire, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'formulaire, 200%');
  });

  test('page de confirmation', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ipFactice() });
    await page.goto(`/s/${fixture.codePublic}/inscription`);
    await page.getByLabel('Prénom').fill('Zoom');
    await page.getByLabel('Nom', { exact: true }).fill('Test320');
    await page.getByLabel('E-mail').fill(`zoom320.${Date.now()}@example.test`);
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: "Je m'inscris" }).click();
    await expect(page).toHaveURL(/confirmation/, { timeout: 45000 });

    await verifierAucunDebordementHorizontal(page, 'confirmation, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'confirmation, 200%');
  });

  test('mon-espace (état annulé)', async ({ page }) => {
    await page.goto(`/p/${jetonAnnule}`);
    await expect(page).toHaveURL(/mon-espace/);

    await verifierAucunDebordementHorizontal(page, 'mon-espace, 100%');
    await appliquerZoom200(page);
    await verifierAucunDebordementHorizontal(page, 'mon-espace, 200%');
  });
});

// Étape 8 (durcissement, point 5) : côté organisateur cette fois — fiche
// séminaire et liste des participants, avec au moins une ligne pour exercer
// le tableau (une liste vide ne teste rien). Séminaire créé dans le cabinet
// PARTAGÉ de l'organisatrice de seed (pas le cabinet jetable ci-dessus, qui
// sert un tout autre scénario public) : mêmes helpers connecter/nettoyage
// que les specs participants des étapes 6-7, pour ne pas laisser de
// séminaire "e2e" s'accumuler dans ce cabinet partagé (cause déjà constatée
// d'un vrai flake ailleurs dans cette suite).
test.describe('320px de large — espace organisateur', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  async function connecter(page: Page) {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
  }

  async function creerSeminaireDeLOrganisatrice() {
    const organisatrice = await prisma.utilisateur.findFirstOrThrow({ where: { email: EMAIL_ORGANISATRICE } });
    const dansUnMois = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const seminaire = await prisma.seminaire.create({
      data: {
        cabinetId: organisatrice.cabinetId,
        codePublic: genererCodePublicSeminaire(),
        titre: `Séminaire e2e 320px ${Date.now()}`,
        description: 'Un descriptif assez long pour vérifier qu\'il ne provoque aucun débordement horizontal à 320px.',
        dateDebut: dansUnMois,
        dateFin: new Date(dansUnMois.getTime() + 8 * 3600 * 1000),
        lieu: 'Dakar',
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 8,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    return { cabinetId: organisatrice.cabinetId, seminaireId: seminaire.id };
  }

  async function nettoyerSeminaire(seminaireId: string): Promise<void> {
    await prisma.inscription.deleteMany({ where: { seminaireId } });
    await prisma.seminaire.delete({ where: { id: seminaireId } });
  }

  test('fiche séminaire', async ({ page }) => {
    const { seminaireId } = await creerSeminaireDeLOrganisatrice();
    try {
      await connecter(page);
      await page.goto(`/organisateur/seminaires/${seminaireId}`);

      await verifierAucunDebordementHorizontal(page, 'fiche séminaire, 100%');
      await appliquerZoom200(page);
      await verifierAucunDebordementHorizontal(page, 'fiche séminaire, 200%');
    } finally {
      await nettoyerSeminaire(seminaireId);
    }
  });

  test('liste des participants (avec au moins une ligne)', async ({ page }) => {
    const { cabinetId, seminaireId } = await creerSeminaireDeLOrganisatrice();
    try {
      const participant = await prisma.participant.create({
        data: {
          cabinetId,
          nom: 'Débordement',
          prenom: 'Test320',
          email: `debordement.320.${Date.now()}@example.test`,
          fonction: 'Une fonction assez longue pour tester le tableau',
          organisation: 'Une organisation au nom également assez long',
        },
      });
      await prisma.inscription.create({
        data: {
          seminaireId,
          participantId: participant.id,
          jeton: genererJetonInscription(),
          statut: StatutInscription.CONFIRMEE,
          source: SourceInscription.MANUEL,
        },
      });

      await connecter(page);
      await page.goto(`/organisateur/seminaires/${seminaireId}/participants`);

      await verifierAucunDebordementHorizontal(page, 'participants, 100%');
      await appliquerZoom200(page);
      await verifierAucunDebordementHorizontal(page, 'participants, 200%');
    } finally {
      await nettoyerSeminaire(seminaireId);
    }
  });
});
