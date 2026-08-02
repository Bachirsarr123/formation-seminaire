import { createHash, randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { TypeJetonAction } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

test.describe('Espace organisateur — liste et agenda des séminaires', () => {
  test('la liste affiche les séminaires du cabinet avec les bonnes colonnes, filtre par titre', async ({ page }) => {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/organisateur\/seminaires$/);

    await expect(page.getByRole('link', { name: 'Séminaire annuel des délégués régionaux' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nouveau séminaire' })).toBeVisible();

    await page.getByLabel('Recherche (titre)').fill('délégués régionaux');
    await page.getByRole('button', { name: 'Filtrer' }).click();

    await expect(page.getByRole('link', { name: 'Séminaire annuel des délégués régionaux' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Atelier restreint — gouvernance associative' })).toHaveCount(0);
  });

  test("l'agenda affiche le lien d'abonnement ICS, dont le contenu ne fuite aucune donnée participant", async ({
    page,
    request,
  }) => {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/organisateur\/seminaires$/);

    await page.goto('/organisateur/seminaires/agenda?mois=2026-04');
    await expect(page.getByRole('heading', { name: /avril 2026/ })).toBeVisible();

    const lienFluxTexte = await page.getByText(/\/organisateur\/seminaires\/agenda\.ics\?jeton=/).textContent();
    expect(lienFluxTexte).toBeTruthy();
    const urlFlux = lienFluxTexte!.trim();

    const reponse = await request.get(urlFlux);
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toContain('text/calendar');
    const corps = await reponse.text();
    expect(corps).toContain('BEGIN:VCALENDAR');
    expect(corps).not.toMatch(/@example\.test/);
  });

  test('un formateur ne voit, dans la liste, que ses propres séminaires — pas de bouton "Nouveau séminaire", pas de section abonnement', async ({
    page,
  }) => {
    const formateur = await prisma.utilisateur.findFirstOrThrow({
      where: { email: 'formateur@meridien-formation.test' },
    });
    const jeton = randomBytes(32).toString('base64url');
    await prisma.jetonActionUtilisateur.create({
      data: {
        utilisateurId: formateur.id,
        type: TypeJetonAction.CONNEXION_FORMATEUR,
        tokenHash: hacherJeton(jeton),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await page.goto(`/organisateur/connexion/formateur/${jeton}`);
    await page.getByRole('button', { name: 'Accéder à mon espace' }).click();
    await expect(page).toHaveURL(/\/organisateur\/seminaires$/);

    // Affecté (seed : formateur Issa Camara, PRINCIPAL sur ce séminaire).
    await expect(page.getByRole('link', { name: 'Séminaire annuel des délégués régionaux' })).toBeVisible();
    // Existe dans le cabinet mais n'est affecté à aucun séminaire de ce formateur.
    await expect(page.getByRole('link', { name: 'Formation certifiante — places limitées' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nouveau séminaire' })).toHaveCount(0);

    await page.goto('/organisateur/seminaires/agenda?mois=2026-04');
    await expect(page.getByText(/Abonnement agenda/)).toHaveCount(0);
  });
});
