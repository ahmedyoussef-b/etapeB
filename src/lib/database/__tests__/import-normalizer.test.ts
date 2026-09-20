import { describe, expect, it } from 'vitest';
import { ImportNormalizer } from '../import-normalizer';

describe('ImportNormalizer', () => {
  const normalizer = new ImportNormalizer();

  it('devrait normaliser une procédure web valide', () => {
    const webData = {
      id: 'web-1',
      title: 'Test Procédure',
      code: 'TEST-001',
      description: 'Description test',
      category: 'Production',
      priority: 'Haute',
      status: 'published',
      estimatedTimeMinutes: 60,
      requiredRoles: ['admin', 'chef-de-quart'],
      globalSafetyInstructions: ['Port des EPI obligatoire'],
      steps: [
        {
          title: 'Étape 1',
          instructions: 'Instructions',
          type: 'consigne',
          isMandatory: true,
        },
      ],
    };

    const result = normalizer.normalizeWebProcedure(webData);

    expect(result.errors).toHaveLength(0);
    expect(result.procedure.metadata.title).toBe('Test Procédure');
    expect(result.procedure.metadata.code).toBe('TEST-001');
    expect(result.procedure.steps).toHaveLength(1);
    expect(result.dbProcedure.status).toBe('published');
  });

  it('devrait gérer les champs manquants avec des valeurs par défaut', () => {
    const webData = {
      title: 'Procédure minimale',
    };

    const result = normalizer.normalizeWebProcedure(webData);

    expect(result.errors).toHaveLength(0);
    expect(result.procedure.metadata.title).toBe('Procédure minimale');
    expect(result.procedure.metadata.code).toBeDefined();
    expect(result.dbProcedure.status).toBe('draft');
    expect(result.procedure.metadata.category).toBe('Production');
  });

  it('devrait mapper correctement les catégories', () => {
    const categories = ['Production', 'Maintenance', 'Sécurité', 'Qualité'];

    for (const cat of categories) {
      const result = normalizer.normalizeWebProcedure({
        title: 'Test',
        category: cat,
      });
      expect(result.procedure.metadata.category).toBe(cat);
    }
  });

  it('devrait mapper correctement les priorités', () => {
    const priorities = ['basse', 'moyenne', 'haute', 'critique'];

    for (const prio of priorities) {
      const result = normalizer.normalizeWebProcedure({
        title: 'Test',
        priority: prio,
      });
      expect(result.procedure.metadata.priority).toBe(prio);
    }
  });

  it('devrait extraire les métadonnées additionnelles', () => {
    const webData = {
      title: 'Test',
      customField: 'valeur personnalisée',
      anotherField: 123,
    };

    const result = normalizer.normalizeWebProcedure(webData);

    expect(result.procedure.metadata).toHaveProperty('customField', 'valeur personnalisée');
    expect(result.dbProcedure.metadata).toHaveProperty('anotherField', 123);
  });
});
