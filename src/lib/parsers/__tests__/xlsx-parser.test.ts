import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { XLSXParser } from '../xlsx-parser';

describe('XLSXParser', () => {
  it('devrait parser un fichier Excel valide', () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['code', 'title', 'step_title'],
      ['TEST-001', 'Procédure Test', 'Étape 1'],
      ['TEST-001', 'Procédure Test', 'Étape 2']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const buffer = XLSX.write(wb, { type: 'array' });
    const result = XLSXParser.parse(buffer);

    expect(result.sheets).toContain('Sheet1');
    expect(result.errors).toHaveLength(0);
  });

  it('devrait convertir Excel en procédures', () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['code', 'title', 'step_title', 'step_instructions'],
      ['TEST-001', 'Procédure Test', 'Étape 1', 'Instructions 1'],
      ['TEST-001', 'Procédure Test', 'Étape 2', 'Instructions 2']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    const buffer = XLSX.write(wb, { type: 'array' });
    const procedures = XLSXParser.parseToProcedures(buffer);

    expect(procedures).toHaveLength(1);
    expect(procedures[0].code).toBe('TEST-001');
    expect(procedures[0].steps).toHaveLength(2);
  });
});
