import { createHash, randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { Modalite, StatutSeminaire, TypeJetonAction } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { supprimerCabinetCompletement } from './creer-fixtures';

function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/organisateur/connexion');
  await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
}

test('création, édition, duplication et cycle de statut d\'un séminaire', async ({ page }) => {
  await connecter(page);

  await page.goto('/organisateur/seminaires/nouveau');
  const titre = `Séminaire e2e CRUD ${Date.now()}`;
  await page.getByLabel('Titre', { exact: true }).fill(titre);
  await page.getByLabel('Début').fill('2026-10-10T09:00');
  await page.getByLabel('Fin').fill('2026-10-10T17:00');
  await page.getByLabel('Lieu').fill('Dakar');
  await page.getByLabel('Durée (heures)').fill('7');
  await page.getByLabel('Titre du module 1').fill('Accueil');
  await page.getByLabel('Durée (min)').fill('30');
  await page.getByRole('button', { name: 'Créer le séminaire' }).click();

  // Motif d'UUID strict : un "[^/]+$" plus permissif matcherait aussi
  // "/organisateur/seminaires/nouveau" lui-même, et laisserait passer
  // silencieusement le test alors qu'on n'a pas encore navigué —
  // exactement le piège qui a fait échouer ce test en course avec la
  // redirection avant qu'il ne se corrige lui-même.
  await expect(page).toHaveURL(/\/organisateur\/seminaires\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  await expect(page.getByRole('heading', { name: titre })).toBeVisible();
  await expect(page.getByText('Accueil')).toBeVisible();
  const urlFiche = page.url();
  const seminaireId = urlFiche.split('/').pop()!;

  // Édition.
  await page.getByRole('link', { name: 'Modifier' }).click();
  const titreModifie = `${titre} (modifié)`;
  await page.getByLabel('Titre', { exact: true }).fill(titreModifie);
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page).toHaveURL(urlFiche);
  await expect(page.getByRole('heading', { name: titreModifie })).toBeVisible();

  // Changement de statut : BROUILLON -> PUBLIE -> BROUILLON (encore autorisé).
  await page.getByLabel('Statut').selectOption('PUBLIE');
  await page.getByRole('button', { name: 'Changer le statut' }).click();
  await expect(page.getByLabel('Statut')).toHaveValue('PUBLIE');
  await page.getByLabel('Statut').selectOption('BROUILLON');
  await page.getByRole('button', { name: 'Changer le statut' }).click();
  await expect(page.getByLabel('Statut')).toHaveValue('BROUILLON');

  // Duplication : structure copiée, jamais les participants.
  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/modifier$/i);
  await expect(page.getByLabel('Titre', { exact: true })).toHaveValue(`${titreModifie} (copie)`);
  await expect(page.getByLabel('Titre du module 1')).toHaveValue('Accueil');

  // Suppression logique du séminaire d'origine : disparaît de la liste.
  await page.goto(urlFiche);
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.getByRole('button', { name: 'Oui, supprimer' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
  await expect(page.getByRole('link', { name: titreModifie, exact: true })).toHaveCount(0);

  // Vérifie aussi côté base que ce n'est pas une suppression physique.
  const enBase = await prisma.seminaire.findUniqueOrThrow({ where: { id: seminaireId } });
  expect(enBase.supprimeLe).not.toBeNull();
});

test("un formateur (lecture seule) ne peut pas créer ni modifier un séminaire", async ({ page }) => {
  const formateur = await prisma.utilisateur.findFirstOrThrow({ where: { email: 'formateur@meridien-formation.test' } });
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

  await page.goto('/organisateur/seminaires/nouveau');
  await expect(page.getByRole('heading', { name: "Vous n'avez pas les droits nécessaires" })).toBeVisible();
});

test("un organisateur du cabinet A obtient un 404 sur la fiche d'un séminaire du cabinet B", async ({ page }) => {
  const cabinetB = await prisma.cabinet.create({ data: { nom: `Cabinet e2e isolation ${Date.now()}` } });
  const seminaireB = await prisma.seminaire.create({
    data: {
      cabinetId: cabinetB.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire du cabinet B',
      dateDebut: new Date('2026-11-01T09:00:00Z'),
      dateFin: new Date('2026-11-01T17:00:00Z'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });

  try {
    await connecter(page);

    await page.goto(`/organisateur/seminaires/${seminaireB.id}`);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
    // Jamais un message qui confirmerait l'existence de la ressource ailleurs.
    await expect(page.getByText(/droits nécessaires/i)).toHaveCount(0);

    await page.goto(`/organisateur/seminaires/${seminaireB.id}/modifier`);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  } finally {
    await supprimerCabinetCompletement(cabinetB.id);
  }
});
