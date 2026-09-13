import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { UnifiedDatabaseService } from '../unified-database.service';
import { LocalDatabaseAdapter } from '../local-adapter';

describe('UnifiedDatabaseService', () => {
  let service: UnifiedDatabaseService;
  const testBasePath = '.test-data-unified';

  beforeAll(async () => {
    const adapter = new LocalDatabaseAdapter(testBasePath);
    service = new UnifiedDatabaseService(adapter);
  });

  afterAll(async () => {
    const adapter = new LocalDatabaseAdapter(testBasePath);
    await adapter.delete(testBasePath).catch(() => {});
  });

  describe('Procédures', () => {
    it('devrait créer une procédure', async () => {
      const procedure = await service.createProcedure({
        title: 'Test Procedure',
        code: 'TEST-001',
        category: 'Production',
        priority: 'Haute',
        status: 'draft',
        steps: [
          {
            id: 'step-1',
            title: 'Step 1',
            instructions: 'Do something',
            type: 'consigne',
            isRequired: true,
            order: 0
          }
        ]
      });

      expect(procedure.id).toBeDefined();
      expect(procedure.title).toBe('Test Procedure');
      expect(procedure.status).toBe('draft');
      expect(procedure.steps).toHaveLength(1);
    });

    it('devrait récupérer une procédure', async () => {
      const created = await service.createProcedure({
        title: 'Get Test',
        code: 'GET-001',
        status: 'published',
        steps: []
      });

      const retrieved = await service.getProcedure(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Get Test');
      expect(retrieved?.status).toBe('published');
    });

    it('devrait lister les procédures', async () => {
      await service.createProcedure({
        title: 'List Test 1',
        status: 'draft',
        steps: []
      });
      await service.createProcedure({
        title: 'List Test 2',
        status: 'published',
        steps: []
      });

      const all = await service.listProcedures();
      expect(all.length).toBeGreaterThanOrEqual(2);

      const drafts = await service.listProcedures({ status: 'draft' });
      expect(drafts.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait mettre à jour une procédure', async () => {
      const created = await service.createProcedure({
        title: 'Update Test',
        status: 'draft',
        steps: []
      });

      const updated = await service.updateProcedure(created.id, {
        title: 'Updated Title',
        status: 'published'
      });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('published');
      expect(updated?.updatedAt).not.toBe(created.updatedAt);
    });

    it('devrait supprimer une procédure', async () => {
      const created = await service.createProcedure({
        title: 'Delete Test',
        status: 'draft',
        steps: []
      });

      const deleted = await service.deleteProcedure(created.id);
      expect(deleted).toBe(true);

      const retrieved = await service.getProcedure(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Utilisateurs', () => {
    it('devrait créer un utilisateur', async () => {
      const user = await service.createUser({
        email: 'test@nexaflow.com',
        name: 'Test User',
        role: 'admin'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@nexaflow.com');
    });

    it('devrait récupérer un utilisateur', async () => {
      const created = await service.createUser({
        email: 'get@nexaflow.com',
        name: 'Get User',
        role: 'rondier'
      });

      const retrieved = await service.getUser(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.email).toBe('get@nexaflow.com');
    });
  });

  describe('Statistiques', () => {
    it('devrait retourner des statistiques', async () => {
      const stats = await service.getStats();

      expect(stats).toHaveProperty('procedures');
      expect(stats).toHaveProperty('users');
      expect(stats).toHaveProperty('teams');
      expect(stats).toHaveProperty('reports');
      expect(stats).toHaveProperty('storage');

      expect(stats.procedures.total).toBeGreaterThanOrEqual(0);
      expect(stats.users.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recherche', () => {
    it('devrait rechercher des données', async () => {
      await service.createProcedure({
        title: 'Recherche Test Procedure',
        code: 'SEARCH-001',
        status: 'published',
        steps: []
      });

      const results = await service.search('Recherche');
      expect(results.procedures.length).toBeGreaterThanOrEqual(1);
    });
  });
});
