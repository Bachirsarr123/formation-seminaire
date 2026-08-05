import { test, expect } from '@playwright/test';
import { Modalite, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/organisateur/connexion');
  await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
}

/**
 * Bug connu et déjà documenté (POINTS-OUVERTS.md, « Origin: null ») : une
 * Server Action de l'espace organisateur est parfois rejetée en 400 par
 * `src/middleware.ts` avant même de s'exécuter, de façon intermittente et
 * non liée au code de cette action précise (diagnostiqué comme un
 * comportement de Next.js lui-même). Le message affiché à l'utilisateur
 * recommande explicitement de recharger et réessayer — c'est exactement ce
 * que ce test fait ici plutôt que de supposer un timeout de compilation.
 */
async function cliquerEtAttendreUrl(
  page: import('@playwright/test').Page,
  cliquer: () => Promise<void>,
  urlAttendue: RegExp | string,
  urlRechargement: string,
): Promise<void> {
  for (let tentative = 1; tentative <= 3; tentative++) {
    await cliquer();
    try {
      await expect(page).toHaveURL(urlAttendue, { timeout: 20000 });
      return;
    } catch (erreur) {
      const corps = (await page.textContent('body').catch(() => '')) ?? '';
      if (!corps.includes('origine non reconnue') || tentative === 3) throw erreur;
      await page.goto(urlRechargement);
    }
  }
}

test('rattachement bout en bout : créer un modèle, l\'attacher à un séminaire, éditer la copie, aperçu', async ({ page }) => {
  const organisatrice = await prisma.utilisateur.findFirstOrThrow({ where: { email: EMAIL_ORGANISATRICE } });
  const cabinetId = organisatrice.cabinetId;
  const suffixe = Date.now();

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: `Séminaire e2e rattachement ${suffixe}`,
      dateDebut: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      dateFin: new Date(Date.now() + 30 * 24 * 3600 * 1000 + 8 * 3600 * 1000),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });

  const modele = await prisma.questionnaire.create({
    data: { cabinetId, estModele: true, nom: `Modèle e2e ${suffixe}`, titre: `Modèle e2e ${suffixe}` },
  });
  const section = await prisma.section.create({ data: { questionnaireId: modele.id, titre: 'Section unique', ordre: 1 } });
  await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction globale', type: TypeQuestion.NOTE_5, obligatoire: true, ordre: 1 },
  });

  try {
    await connecter(page);

    // Fiche séminaire : pas encore de questionnaire.
    await page.goto(`/organisateur/seminaires/${seminaire.id}`);
    await page.getByRole('link', { name: "Créer le questionnaire d'évaluation" }).click();
    // Timeout généreux (au lieu des 15000ms par défaut) : ces routes n'entrent
    // au préchauffage qu'à l'étape 14 (global-setup.ts) — leur toute première
    // compilation en dev peut largement dépasser 15s, comme documenté dans
    // playwright.config.ts (navigationTimeout 150000ms) et POINTS-OUVERTS.md.
    await expect(page).toHaveURL(new RegExp(`/organisateur/seminaires/${seminaire.id}/questionnaire/choisir-modele$`), {
      timeout: 45000,
    });

    // Choisir le modèle créé pour ce test.
    const urlChoisirModele = page.url();
    await cliquerEtAttendreUrl(
      page,
      () => page.locator('li', { hasText: `Modèle e2e ${suffixe}` }).getByRole('button', { name: 'Choisir' }).click(),
      /\/organisateur\/questionnaires\/[0-9a-f-]{36}$/i,
      urlChoisirModele,
    );
    const urlCopie = page.url();
    const idCopie = urlCopie.split('/').pop()!;
    expect(idCopie).not.toBe(modele.id);
    await expect(page.getByText('Satisfaction globale')).toBeVisible();

    // Modifier la copie : le modèle d'origine ne doit pas changer.
    await page.getByRole('link', { name: 'Modifier' }).click();
    const urlModifier = page.url();
    await cliquerEtAttendreUrl(
      page,
      async () => {
        await page.getByLabel('Intitulé').fill('Satisfaction globale (modifiée pour ce séminaire)');
        await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
      },
      urlCopie,
      urlModifier,
    );
    await expect(page.getByText('Satisfaction globale (modifiée pour ce séminaire)')).toBeVisible();

    const questionModele = await prisma.question.findFirstOrThrow({ where: { sectionId: section.id } });
    expect(questionModele.intitule).toBe('Satisfaction globale');

    // Aperçu : rend la question, en lecture seule (fieldset disabled).
    await page.getByRole('link', { name: 'Aperçu' }).click();
    await expect(page).toHaveURL(`${urlCopie}/apercu`, { timeout: 45000 });
    await expect(page.getByText('Satisfaction globale (modifiée pour ce séminaire)')).toBeVisible();
    await expect(page.locator('fieldset[disabled]')).toBeVisible();

    // Retour à la fiche séminaire : le lien pointe maintenant vers la copie.
    await page.goto(`/organisateur/seminaires/${seminaire.id}`);
    await expect(page.getByRole('link', { name: /Brouillon — /i })).toHaveAttribute(
      'href',
      `/organisateur/questionnaires/${idCopie}`,
    );
  } finally {
    await prisma.section.deleteMany({ where: { questionnaireId: { in: [modele.id] } } });
    const copies = await prisma.questionnaire.findMany({ where: { seminaireId: seminaire.id }, select: { id: true } });
    await prisma.section.deleteMany({ where: { questionnaireId: { in: copies.map((c) => c.id) } } });
    await prisma.questionnaire.updateMany({ where: { seminaireId: seminaire.id }, data: { modeleOrigineId: null } });
    await prisma.questionnaire.deleteMany({ where: { seminaireId: seminaire.id } });
    await prisma.questionnaire.delete({ where: { id: modele.id } });
    await prisma.seminaire.delete({ where: { id: seminaire.id } });
  }
});
