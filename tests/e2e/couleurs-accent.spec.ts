import { test } from '@playwright/test';
import { creerSeminaireOuvert, supprimerCabinetCompletement, type SeminaireOuvertFixture } from './creer-fixtures';

// Dossier scratchpad de la session — hors du dépôt projet, adapté aux
// fichiers temporaires générés pendant la vérification.
const DOSSIER_CAPTURES =
  'C:/Users/SBASAR~1/AppData/Local/Temp/claude/C--dev-formation-seminaire/62efe218-2489-460f-9293-1d0d191a60f5/scratchpad/qa-screenshots';

test.use({ viewport: { width: 390, height: 844 } });

const COULEURS = [
  { nom: 'bleu-fonce', couleur: '#0B3D91' },
  { nom: 'vert-vif', couleur: '#16A34A' },
  { nom: 'orange', couleur: '#F97316' },
] as const;

for (const { nom, couleur } of COULEURS) {
  test.describe(`accent ${nom}`, () => {
    let fixture: SeminaireOuvertFixture;

    test.beforeAll(async () => {
      fixture = await creerSeminaireOuvert({ couleurPrimaire: couleur });
    });

    test.afterAll(async () => {
      await supprimerCabinetCompletement(fixture.cabinetId);
    });

    test(`capture — accent ${nom} (page publique)`, async ({ page }) => {
      await page.goto(`/s/${fixture.codePublic}`);
      await page.screenshot({ path: `${DOSSIER_CAPTURES}/accent-${nom}-public.png`, fullPage: true });
    });

    test(`capture — accent ${nom} (formulaire d'inscription)`, async ({ page }) => {
      await page.goto(`/s/${fixture.codePublic}/inscription`);
      await page.screenshot({ path: `${DOSSIER_CAPTURES}/accent-${nom}-inscription.png`, fullPage: true });
    });
  });
}
