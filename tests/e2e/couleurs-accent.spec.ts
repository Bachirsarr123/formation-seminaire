import { test } from '@playwright/test';
import { CODE_PUBLIC_BLEU, CODE_PUBLIC_ORANGE, CODE_PUBLIC_VERT } from './fixtures';

// Dossier scratchpad de la session — hors du dépôt projet, adapté aux
// fichiers temporaires générés pendant la vérification.
const DOSSIER_CAPTURES =
  'C:/Users/SBASAR~1/AppData/Local/Temp/claude/C--Users-sbasarr200-OneDrive-Desktop-FORMATIOM-SEMIMAIRE/f01c7857-9696-40e2-89a8-408363aee217/scratchpad/qa-screenshots';

test.use({ viewport: { width: 390, height: 844 } });

const COULEURS = [
  { nom: 'bleu-fonce', code: CODE_PUBLIC_BLEU },
  { nom: 'vert-vif', code: CODE_PUBLIC_VERT },
  { nom: 'orange', code: CODE_PUBLIC_ORANGE },
] as const;

for (const { nom, code } of COULEURS) {
  test(`capture — accent ${nom} (page publique)`, async ({ page }) => {
    await page.goto(`/s/${code}`);
    await page.screenshot({ path: `${DOSSIER_CAPTURES}/accent-${nom}-public.png`, fullPage: true });
  });

  test(`capture — accent ${nom} (formulaire d'inscription)`, async ({ page }) => {
    await page.goto(`/s/${code}/inscription`);
    await page.screenshot({ path: `${DOSSIER_CAPTURES}/accent-${nom}-inscription.png`, fullPage: true });
  });
}
