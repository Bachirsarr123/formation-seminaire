import { createHash, randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { RoleUtilisateur, TypeJetonAction } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

// Duplique volontairement le hash d'un seul SHA-256 (lib/organisateur/jeton-hash.ts
// est protégé par `import 'server-only'`, non importable depuis ce test qui
// tourne hors du contexte de requête Next.js) plutôt que d'importer le module.
function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

test.describe('Connexion organisateur', () => {
  test('identifiants corrects : accès au tableau de bord, puis déconnexion réelle', async ({ page }) => {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
    await expect(page.getByText('Cabinet Méridien Formation')).toBeVisible();

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/organisateur\/connexion$/);

    // La session est réellement détruite côté serveur, pas seulement le
    // cookie : revenir sur /organisateur doit renvoyer vers la connexion.
    await page.goto('/organisateur');
    await expect(page).toHaveURL(/\/organisateur\/connexion$/);
  });

  test('mot de passe incorrect : message générique, pas d\'accès', async ({ page }) => {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/organisateur\/connexion$/);
  });

  test('email inconnu : exactement le même message que mot de passe incorrect', async ({ page }) => {
    await page.goto('/organisateur/connexion');
    await page.getByLabel('E-mail').fill('personne-de-connu@example.test');
    await page.getByLabel('Mot de passe').fill('peu-importe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
  });
});

test.describe('Mot de passe oublié — même message, compte existant ou non', () => {
  test('email existant', async ({ page }) => {
    await page.goto('/organisateur/connexion/mot-de-passe-oublie');
    await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe avec cette adresse/)).toBeVisible();
  });

  test('email inconnu', async ({ page }) => {
    await page.goto('/organisateur/connexion/mot-de-passe-oublie');
    await page.getByLabel('E-mail').fill('personne-de-connu@example.test');
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByText(/Si un compte existe avec cette adresse/)).toBeVisible();
  });
});

test('réinitialisation du mot de passe : le nouveau mot de passe fonctionne ensuite pour se connecter', async ({
  page,
}) => {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet reset e2e' } });
  const email = `reset.e2e.${Date.now()}@example.test`;
  const utilisateur = await prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email,
      nom: 'Test',
      prenom: 'E2E',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash: null,
    },
  });
  const jeton = randomBytes(32).toString('base64url');
  await prisma.jetonActionUtilisateur.create({
    data: {
      utilisateurId: utilisateur.id,
      type: TypeJetonAction.REINITIALISATION_MOT_DE_PASSE,
      tokenHash: hacherJeton(jeton),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  await page.goto(`/organisateur/connexion/reinitialiser/${jeton}`);
  await page.getByLabel('Nouveau mot de passe').fill('NouveauMotDePasseE2E!1');
  await page.getByLabel('Confirmer le mot de passe').fill('NouveauMotDePasseE2E!1');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();

  await expect(page).toHaveURL(/\/organisateur\/connexion/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('NouveauMotDePasseE2E!1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
});
