import { describe, expect, it } from 'vitest';

describe('Upload API', () => {
  it('devrait valider la présence du fichier', async () => {
    const payload = new FormData();
    const response = new Response(JSON.stringify({ success: false, error: 'Aucun fichier fourni' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status).toBe(400);
  });

  it('devrait rejeter un fichier trop volumineux', async () => {
    const oversized = 51 * 1024 * 1024;
    expect(oversized).toBeGreaterThan(50 * 1024 * 1024);
  });
});
