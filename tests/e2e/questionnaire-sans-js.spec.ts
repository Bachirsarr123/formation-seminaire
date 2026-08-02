import { test, expect } from '@playwright/test';
import { JETON_QUESTIONNAIRE, JETON_QUESTIONNAIRE_VALIDATION } from './fixtures';

// Contrainte la plus importante du lot (voir globals.css : échelle de
// notation en input radio natif + révélation du grand chiffre par CSS
// :has(), aucun JS) : le questionnaire complet doit être remplissable et
// soumettable sans JavaScript. javaScriptEnabled: false désactive le JS de
// la PAGE — Playwright pilote toujours le navigateur via CDP.
test.use({ javaScriptEnabled: false });

test('questionnaire complet, sans JavaScript, jusqu\'à l\'écran de remerciement', async ({ page }) => {
  await page.goto(`/p/${JETON_QUESTIONNAIRE}`);
  await expect(page).toHaveURL(/\/mon-espace$/);

  await page.getByRole('link', { name: 'Répondre au questionnaire' }).click();
  await expect(page).toHaveURL(/\/mon-espace\/questionnaire$/);
  await expect(page.getByText('Vos réponses sont anonymes.')).toBeVisible();

  // Échelle de notation : case radio native, aucune interaction JS requise.
  // On clique le <label> (la case visible), pas l'input associé : c'est
  // exactement le geste d'un vrai utilisateur — l'input est volontairement
  // réduit à un point non cliquable pour la souris (masqué visuellement,
  // activé par label[for], identique à .reserve-lecteur-ecran), donc
  // getByLabel().click() (qui cible la boîte de l'input) ne convient pas ici.
  await page
    .getByRole('group', { name: 'Satisfaction globale' })
    .getByText('4', { exact: true })
    .click();

  await page
    .getByRole('group', { name: 'Recommanderiez-vous ce séminaire ?' })
    .getByText('8', { exact: true })
    .click();

  await page
    .getByRole('group', { name: 'Vos remarques libres' })
    .getByRole('textbox')
    .fill('Très bon séminaire, contenu clair.');

  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();

  await expect(page).toHaveURL(/\/mon-espace\/questionnaire\/merci$/, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: "Merci d'avoir répondu." })).toBeVisible();

  // Le bouton précédent du navigateur ne doit pas rouvrir le formulaire déjà envoyé.
  await page.goBack();
  await expect(page).toHaveURL(/\/mon-espace\/questionnaire\/merci$/);
  await expect(page.getByRole('heading', { name: "Merci d'avoir répondu." })).toBeVisible();
});

test('une question obligatoire non répondue bloque nativement l\'envoi (HTML required, sans JS), réponses déjà saisies préservées', async ({ page }) => {
  await page.goto(`/p/${JETON_QUESTIONNAIRE_VALIDATION}`);
  await page.getByRole('link', { name: 'Répondre au questionnaire' }).click();

  const remarque = 'Je remplis ce champ avant de tenter un envoi incomplet.';
  await page
    .getByRole('group', { name: 'Vos remarques libres' })
    .getByRole('textbox')
    .fill(remarque);

  // Satisfaction globale (obligatoire) volontairement laissée vide : la
  // validation native HTML (required sur le groupe radio) doit bloquer
  // l'envoi avant même d'atteindre le serveur — aucun JavaScript requis.
  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();

  await expect(page).toHaveURL(/\/mon-espace\/questionnaire$/);
  await expect(page.getByRole('heading', { name: "Merci d'avoir répondu." })).not.toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Vos remarques libres' }).getByRole('textbox'),
  ).toHaveValue(remarque);
});
