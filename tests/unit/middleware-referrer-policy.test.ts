import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

describe('Middleware /p/* — en-tête Referrer-Policy', () => {
  it('ajoute Referrer-Policy: no-referrer sur les routes /p/*', () => {
    const request = new NextRequest('http://localhost/p/un-jeton-quelconque');

    const response = middleware(request);

    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});
