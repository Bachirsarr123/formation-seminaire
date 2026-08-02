import { test, expect, type APIRequestContext } from '@playwright/test';
import { CODE_PUBLIC_BLEU, ipFactice } from './fixtures';

/**
 * Les Server Actions Next.js vérifient nativement l'origine de la requête
 * (depuis 13.4) : une soumission dont l'en-tête Origin ne correspond pas au
 * Host est rejetée avant d'atteindre le code de l'action. Ce projet ne
 * double pas cette protection par un jeton CSRF maison (décision assumée,
 * lot 4) — ce test existe pour que, le jour où ce comportement change
 * (montée de version Next, configuration `serverActions.allowedOrigins`),
 * on l'apprenne par un échec de test plutôt que par un incident.
 *
 * Rejoue exactement l'encodage qu'un vrai <form> produit pour une Server
 * Action sans JavaScript (progressive enhancement : $ACTION_1:0/:1,
 * $ACTION_KEY) — vérifié empiriquement contre le rendu réel de la page
 * d'inscription. Les champs sont extraits d'un GET fait juste avant chaque
 * requête, jamais codés en dur : jetonFormulaireTimestamp/Signature
 * (lib/anti-spam.ts) sont signés et datés, un couple figé serait invalide
 * dès le second run.
 */

async function recupererFormulaireEncode(request: APIRequestContext, baseURL: string) {
  const reponse = await request.get(`${baseURL}/s/${CODE_PUBLIC_BLEU}/inscription`);
  const html = await reponse.text();

  const extraire = (motif: RegExp) => {
    const trouve = html.match(motif);
    if (!trouve) throw new Error(`Champ introuvable dans la page d'inscription (motif ${motif})`);
    return trouve[1]!.replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  };

  return {
    action0: extraire(/name="\$ACTION_1:0" value="([^"]*)"/),
    action1: extraire(/name="\$ACTION_1:1" value="([^"]*)"/),
    actionKey: extraire(/name="\$ACTION_KEY" value="([^"]*)"/),
    timestamp: extraire(/name="jetonFormulaireTimestamp" value="([^"]*)"/),
    signature: extraire(/name="jetonFormulaireSignature" value="([^"]*)"/),
  };
}

function corpsMultipart(champs: Awaited<ReturnType<typeof recupererFormulaireEncode>>) {
  return {
    '$ACTION_REF_1': '',
    '$ACTION_1:0': champs.action0,
    '$ACTION_1:1': champs.action1,
    '$ACTION_KEY': champs.actionKey,
    jetonFormulaireTimestamp: champs.timestamp,
    jetonFormulaireSignature: champs.signature,
  };
}

test('une Server Action appelée avec une origine étrangère est rejetée avant de s\'exécuter', async ({ request, baseURL }) => {
  const champs = await recupererFormulaireEncode(request, baseURL!);

  const reponse = await request.post(`${baseURL}/s/${CODE_PUBLIC_BLEU}/inscription`, {
    headers: { Origin: 'https://evil.example', 'x-forwarded-for': ipFactice() },
    multipart: corpsMultipart(champs),
  });

  expect(reponse.status()).toBe(500);
  expect(await reponse.text()).toContain('Invalid Server Actions request.');
});

test('la même requête, avec l\'origine du déploiement, atteint bien l\'action', async ({ request, baseURL }) => {
  const champs = await recupererFormulaireEncode(request, baseURL!);

  const reponse = await request.post(`${baseURL}/s/${CODE_PUBLIC_BLEU}/inscription`, {
    headers: { Origin: baseURL!, 'x-forwarded-for': ipFactice() },
    multipart: corpsMultipart(champs),
  });

  expect(reponse.status()).toBe(200);
  expect(await reponse.text()).not.toContain('Invalid Server Actions request.');
});
