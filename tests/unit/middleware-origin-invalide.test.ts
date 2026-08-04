import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

function requetePost(pathname: string, origin?: string): NextRequest {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  return new NextRequest(`http://localhost${pathname}`, { method: 'POST', headers });
}

describe("Middleware /organisateur/* — garde-fou sur l'en-tête Origin (lot 4, étape 8)", () => {
  it('rejette en 400 propre une requête POST portant Origin: null (littéral)', async () => {
    const response = middleware(requetePost('/organisateur/seminaires/nouveau', 'null'));

    expect(response.status).toBe(400);
    const corps = await response.json();
    expect(corps.error).toMatch(/origine/i);
  });

  it('rejette en 400 une origine présente mais non analysable comme URL', async () => {
    const response = middleware(requetePost('/organisateur/seminaires/nouveau', 'pas-une-url'));

    expect(response.status).toBe(400);
  });

  it("n'affecte jamais une requête portant une origine valide — un garde-fou qui bloquerait le cas légitime serait pire que le bug", () => {
    const response = middleware(requetePost('/organisateur/seminaires/nouveau', 'http://localhost:3000'));

    expect(response.status).not.toBe(400);
  });

  it("n'affecte jamais une requête sans en-tête Origin du tout (absence ≠ valeur invalide)", () => {
    const response = middleware(requetePost('/organisateur/seminaires/nouveau'));

    expect(response.status).not.toBe(400);
  });

  it('ne filtre jamais les requêtes GET, même avec une origine invalide', () => {
    const headers = new Headers({ origin: 'null' });
    const request = new NextRequest('http://localhost/organisateur/seminaires', { method: 'GET', headers });

    const response = middleware(request);

    expect(response.status).not.toBe(400);
  });

  it('ne filtre jamais les requêtes POST hors de /organisateur', () => {
    const response = middleware(requetePost('/s/un-code-public/inscription', 'null'));

    expect(response.status).not.toBe(400);
  });
});
