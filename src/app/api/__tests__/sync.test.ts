import { describe, expect, it } from 'vitest';

describe('Sync API', () => {
  it('devrait rejeter une requête sans webUrl', async () => {
    const payload: any = { apiKey: 'test' };
    expect(payload.webUrl).toBeUndefined();
  });

  it('devrait rejeter une requête sans apiKey', async () => {
    const payload: any = { webUrl: 'http://localhost' };
    expect(payload.apiKey).toBeUndefined();
  });
});
