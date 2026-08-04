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

async function creerSeminaireDeLOrganisatrice(overrides: { capaciteMax?: number | null; validationRequise?: boolean } = {}) {
  const organisatrice = await prisma.utilisateur.findFirstOrThrow({ where: { email: EMAIL_ORGANISATRICE } });
  const dansUnMois = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: organisatrice.cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: `Séminaire e2e participants ${Date.now()}`,
      dateDebut: dansUnMois,
      dateFin: new Date(dansUnMois.getTime() + 8 * 3600 * 1000),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 8,
      statut: StatutSeminaire.PUBLIE,
      capaciteMax: overrides.capaciteMax ?? null,
      validationRequise: overrides.validationRequise ?? false,
    },
  });
  return { cabinetId: organisatrice.cabinetId, seminaireId: seminaire.id };
}

async function ajouterInscriptionDirecte(
  cabinetId: string,
  seminaireId: string,
  params: { nom: string; prenom: string; statut: StatutInscription; aReponduLe?: Date },
) {
  const participant = await prisma.participant.create({
    data: {
      cabinetId,
      nom: params.nom,
      prenom: params.prenom,
      email: `${params.prenom}.${params.nom}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`,
    },
  });
  const inscription = await prisma.inscription.create({
    data: {
      seminaireId,
      participantId: participant.id,
      jeton: genererJetonInscription(),
      statut: params.statut,
      source: SourceInscription.MANUEL,
      ...(params.aReponduLe ? { aRepondu: true, aReponduLe: params.aReponduLe } : {}),
    },
  });
  return { participant, inscription };
}

// Ce test crée son séminaire directement dans le cabinet PARTAGÉ de
// l'organisatrice de seed (pas un cabinet jetable dédié) : sans nettoyage,
// des rejeux successifs accumulent des séminaires "Séminaire e2e
// participants ..." qui finissent par repousser les séminaires du seed hors
// de la première page de la liste (non paginée dans
// organisateur-seminaires.spec.ts) — bug constaté en pratique. Toujours
// nettoyer dans un `finally`, y compris si une assertion échoue.
async function nettoyerSeminaire(seminaireId: string): Promise<void> {
  await prisma.inscription.deleteMany({ where: { seminaireId } });
  await prisma.seminaire.delete({ where: { id: seminaireId } });
}

test('liste, ajout manuel, validation/refus, annulation, régénération de jeton et export CSV', async ({ page }) => {
  const { cabinetId, seminaireId } = await creerSeminaireDeLOrganisatrice({ validationRequise: true });
  try {
    const enAttente = await ajouterInscriptionDirecte(cabinetId, seminaireId, {
      nom: 'Attente',
      prenom: 'Enatt',
      statut: StatutInscription.EN_ATTENTE,
    });
    const aRepondu = await ajouterInscriptionDirecte(cabinetId, seminaireId, {
      nom: 'Repondu',
      prenom: 'Arep',
      statut: StatutInscription.CONFIRMEE,
      aReponduLe: new Date('2027-03-15'),
    });

    await connecter(page);
    await page.goto(`/organisateur/seminaires/${seminaireId}/participants`);

    // Jauge : deux inscriptions occupent une place (EN_ATTENTE compte comme
    // CONFIRMEE, décision 9).
    await expect(page.getByText('2 inscrits')).toBeVisible();

    // Colonne « a répondu » en Oui/Non strict, jamais la date exacte — ni dans
    // le HTML rendu, ni (plus bas) dans le CSV exporté.
    const contenuPage = await page.content();
    expect(contenuPage).not.toContain('2027-03-15');
    expect(contenuPage).not.toContain('aReponduLe');
    await expect(page.getByRole('row', { name: /Arep Repondu/ }).getByText('Oui', { exact: true })).toBeVisible();

    // Valider l'inscription EN_ATTENTE.
    const ligneEnAttente = page.getByRole('row', { name: /Enatt Attente/ });
    await ligneEnAttente.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('row', { name: /Enatt Attente/ }).getByText('Confirmée', { exact: true })).toBeVisible();

    // Ajout manuel : toujours confirmé directement, malgré validationRequise.
    await page.getByRole('button', { name: '+ Ajouter un participant' }).click();
    await page.getByLabel('Nom', { exact: true }).fill('Manuel');
    await page.getByLabel('Prénom').fill('Ajout');
    await page.getByLabel('Email').fill(`manuel.ajout.${Date.now()}@example.test`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const ligneManuelle = page.getByRole('row', { name: /Ajout Manuel/ });
    await expect(ligneManuelle.getByText('Confirmée', { exact: true })).toBeVisible();
    await expect(page.getByText('3 inscrits')).toBeVisible();

    // Annuler libère immédiatement une place (décision 9).
    await ligneManuelle.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('row', { name: /Ajout Manuel/ }).getByText('Annulée', { exact: true })).toBeVisible();
    await expect(page.getByText('2 inscrits')).toBeVisible();

    // Régénération de jeton : avertissement explicite avant confirmation.
    const jetonAvant = (await prisma.inscription.findUniqueOrThrow({ where: { id: aRepondu.inscription.id } })).jeton;
    const ligneRepondu = page.getByRole('row', { name: /Arep Repondu/ });
    await ligneRepondu.getByRole('button', { name: 'Régénérer le jeton' }).click();
    await expect(page.getByText(/cessera immédiatement de fonctionner/)).toBeVisible();
    await expect(page.getByText(/transféré ou mis en favori/)).toBeVisible();
    await page.getByRole('button', { name: 'Oui, régénérer' }).click();
    await expect(page.getByText(/cessera immédiatement de fonctionner/)).toHaveCount(0);
    const jetonApres = (await prisma.inscription.findUniqueOrThrow({ where: { id: aRepondu.inscription.id } })).jeton;
    expect(jetonApres).not.toBe(jetonAvant);

    // Export CSV : ni jeton, ni « a répondu »/date de réponse.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exporter en CSV' }).click(),
    ]);
    const flux = await download.createReadStream();
    const morceaux: Buffer[] = [];
    for await (const morceau of flux!) morceaux.push(morceau as Buffer);
    const csv = Buffer.concat(morceaux).toString('utf-8');

    expect(csv.toLowerCase()).not.toContain('jeton');
    expect(csv.toLowerCase()).not.toContain('répondu');
    expect(csv).not.toContain('2027-03-15');
    expect(csv).not.toContain('15/03/2027');
    expect(csv).not.toContain(jetonApres);
    expect(csv).toContain('Repondu');
    expect(csv).toContain('Attente');
  } finally {
    await nettoyerSeminaire(seminaireId);
  }
});

test("un organisateur du cabinet A obtient un 404 sur les participants d'un séminaire du cabinet B", async ({ page }) => {
  const cabinetB = await prisma.cabinet.create({ data: { nom: `Cabinet e2e participants isolation ${Date.now()}` } });
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

  await connecter(page);
  await page.goto(`/organisateur/seminaires/${seminaireB.id}/participants`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();

  await page.goto(`/organisateur/seminaires/${seminaireB.id}/participants/export`);
  await expect(page.getByText(/Introuvable/)).toBeVisible();
});
