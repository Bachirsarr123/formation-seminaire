import { test, expect } from '@playwright/test';
import { Modalite, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire, genererJetonInscription } from '../../src/lib/jeton';

const EMAIL_ORGANISATRICE = 'organisatrice@meridien-formation.test';
const MOT_DE_PASSE = 'ChangeMe!2026-demo-seed';

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/organisateur/connexion');
  await page.getByLabel('E-mail').fill(EMAIL_ORGANISATRICE);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur\/seminaires$/);
}

async function creerSeminaireDeLOrganisatrice(capaciteMax: number | null = null) {
  const organisatrice = await prisma.utilisateur.findFirstOrThrow({ where: { email: EMAIL_ORGANISATRICE } });
  const dansUnMois = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: organisatrice.cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: `Séminaire e2e import ${Date.now()}`,
      dateDebut: dansUnMois,
      dateFin: new Date(dansUnMois.getTime() + 8 * 3600 * 1000),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 8,
      statut: StatutSeminaire.PUBLIE,
      capaciteMax,
    },
  });
  return { cabinetId: organisatrice.cabinetId, seminaireId: seminaire.id };
}

// Ces specs créent leurs séminaires directement dans le cabinet PARTAGÉ de
// l'organisatrice de seed (pas un cabinet jetable dédié comme les tests
// d'isolation) : sans nettoyage, les rejeux successifs de la suite
// accumulent des séminaires "Séminaire e2e import ..." qui finissent par
// repousser les séminaires du seed hors de la première page de la liste
// (non paginée dans organisateur-seminaires.spec.ts) — bug constaté en
// pratique, pas hypothétique. Toujours nettoyer dans un `finally`, y
// compris quand l'assertion du test échoue.
async function nettoyerSeminaire(seminaireId: string): Promise<void> {
  await prisma.importEnAttente.deleteMany({ where: { seminaireId } });
  await prisma.inscription.deleteMany({ where: { seminaireId } });
  await prisma.seminaire.delete({ where: { id: seminaireId } });
}

test('import CSV : aperçu (valide/doublon/erreur) puis confirmation, source Import dans la liste', async ({ page }) => {
  const { seminaireId } = await creerSeminaireDeLOrganisatrice();
  try {
    const suffixe = Date.now();
    const emailValide = `import.valide.${suffixe}@example.test`;

    const csv = [
      'Nom;Prenom;Email;Telephone;Fonction;Organisation',
      `Diop;Awa;${emailValide};;;`,
      `Diop;Awa;${emailValide.toUpperCase()};;;`, // doublon fichier
      ';Sans Nom;;;;', // erreur : nom manquant
    ].join('\n');

    await connecter(page);
    await page.goto(`/organisateur/seminaires/${seminaireId}/participants/import`);

    await page.getByLabel('Fichier CSV').setInputFiles({
      name: 'participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await page.getByRole('button', { name: 'Prévisualiser' }).click();

    await expect(page.getByText('dont 1 valide à importer')).toBeVisible();
    await expect(page.getByText('Doublons dans le fichier (1)')).toBeVisible();
    await expect(page.getByText('Erreurs (1)')).toBeVisible();

    await page.getByRole('button', { name: /Confirmer l'import de 1 participant/ }).click();
    await expect(page.getByText('1 participant importé')).toBeVisible();

    await page.getByRole('link', { name: 'Retour à la liste des participants' }).click();
    await expect(page).toHaveURL(new RegExp(`/organisateur/seminaires/${seminaireId}/participants$`));
    const ligne = page.getByRole('row', { name: /Awa Diop/ });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText('Import', { exact: true })).toBeVisible();
  } finally {
    await nettoyerSeminaire(seminaireId);
  }
});

test("capacité insuffisante : message clair, aucune ligne écrite", async ({ page }) => {
  const { cabinetId, seminaireId } = await creerSeminaireDeLOrganisatrice(1);
  try {
    // Sature la seule place disponible avant l'import.
    const occupant = await prisma.participant.create({
      data: { cabinetId, nom: 'Occupant', prenom: 'Place', email: `occupant.e2e.${Date.now()}@example.test` },
    });
    await prisma.inscription.create({
      data: {
        seminaireId,
        participantId: occupant.id,
        jeton: genererJetonInscription(),
        statut: StatutInscription.CONFIRMEE,
        source: SourceInscription.MANUEL,
      },
    });

    const emailImport = `import.complet.${Date.now()}@example.test`;
    const csv = ['Nom;Prenom;Email', `Nouveau;Venu;${emailImport}`].join('\n');

    await connecter(page);
    await page.goto(`/organisateur/seminaires/${seminaireId}/participants/import`);

    await page.getByLabel('Fichier CSV').setInputFiles({
      name: 'participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await page.getByRole('button', { name: 'Prévisualiser' }).click();
    await page.getByRole('button', { name: /Confirmer l'import de 1 participant/ }).click();

    await expect(page.getByText(/place\(s\) disponible\(s\)/)).toBeVisible();

    const inscriptions = await prisma.inscription.count({ where: { seminaireId } });
    expect(inscriptions).toBe(1);
    const participantImporte = await prisma.participant.findFirst({ where: { email: emailImport } });
    expect(participantImporte).toBeNull();
  } finally {
    await nettoyerSeminaire(seminaireId);
  }
});
