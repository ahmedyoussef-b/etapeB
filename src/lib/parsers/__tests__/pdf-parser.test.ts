import { describe, expect, it } from 'vitest';
import { PDFParser } from '../pdf-parser';

describe('PDFParser', () => {
  it.skip('devrait parser un PDF en procédures', async () => {
    const pdfContent = `
PROCÉDURE TEST-001
Procédure de test
Étape 1: Vérification initiale
Vérifier que tout est en ordre
Étape 2: Exécution
Exécuter la procédure
    `;

    const buffer = Buffer.from(pdfContent);
    const procedures = await PDFParser.parseToProcedures(buffer);

    expect(procedures.length).toBeGreaterThan(0);
    expect(procedures[0].title).toContain('PROCÉDURE');
  });

  it('devrait exporter la méthode parseToProcedures', async () => {
    expect(typeof PDFParser.parseToProcedures).toBe('function');
  });
});
