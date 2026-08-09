import { test, expect } from '@playwright/test';

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
});
