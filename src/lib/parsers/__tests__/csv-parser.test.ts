import { describe, expect, it } from 'vitest';
import { CSVParser } from '../csv-parser';

describe('CSVParser', () => {
  const sampleCSV = `code,title,description,category,priority,step_title,step_instructions,step_type
TEST-001,Procédure Test,Description test,Production,Haute,Étape 1,Instructions étape 1,consigne
TEST-001,Procédure Test,Description test,Production,Haute,Étape 2,Instructions étape 2,inspection
TEST-002,Procédure Test 2,Description test 2,Maintenance,Critique,Étape 1,Instructions étape 1,validation`;

  it('devrait parser un CSV valide', () => {
    const result = CSVParser.parse(sampleCSV);
    expect(result.headers).toContain('code');
    expect(result.headers).toContain('title');
    expect(result.rows).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it('devrait convertir CSV en procédures', () => {
    const procedures = CSVParser.parseToProcedures(sampleCSV);
    expect(procedures).toHaveLength(2);
    expect(procedures[0].code).toBe('TEST-001');
    expect(procedures[0].steps).toHaveLength(2);
    expect(procedures[1].code).toBe('TEST-002');
    expect(procedures[1].steps).toHaveLength(1);
  });

  it('devrait gérer les colonnes manquantes', () => {
    const minimalCSV = `title,code
Procédure Test,TEST-003`;
    const procedures = CSVParser.parseToProcedures(minimalCSV);
    expect(procedures[0].title).toBe('Procédure Test');
    expect(procedures[0].category).toBe('Production');
  });
});
