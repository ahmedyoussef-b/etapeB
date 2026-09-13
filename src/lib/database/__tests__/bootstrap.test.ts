import { describe, expect, it, beforeEach } from 'vitest';
import { LocalDatabaseAdapter } from '../local-adapter';
import { UnifiedDatabaseService } from '../unified-database.service';
import { initializeLocalDatabase } from '../bootstrap';

describe('initializeLocalDatabase', () => {
  const basePath = '.test-bootstrap-db';

  beforeEach(async () => {
    const adapter = new LocalDatabaseAdapter(basePath);
    await adapter.delete(basePath).catch(() => undefined);
  });

  it('initialise les index, les équipes et les procédures par défaut', async () => {
    const result = await initializeLocalDatabase(basePath, {
      seedTeams: [
        { id: 'team-1', name: 'Équipe test', members: ['u-1'], leader: 'u-1', createdAt: new Date().toISOString() }
      ],
      seedUsers: [
        { id: 'u-1', email: 'test@nexaflow.com', name: 'Test User', role: 'admin', createdAt: new Date().toISOString() }
      ],
      seedProcedures: [
        {
          id: 'proc-1',
          title: 'Procédure test',
          code: 'TEST-001',
          category: 'Production',
          priority: 'Haute',
          status: 'draft',
          requiredRoles: ['admin'],
          steps: [
            {
              id: 'step-1',
              title: 'Étape test',
              instructions: 'Vérifier le système',
              type: 'consigne',
              isRequired: true,
              order: 0
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'u-1'
        }
      ]
    });

    expect(result.initialized).toBe(true);
    expect(result.stats.procedures.total).toBeGreaterThanOrEqual(1);
    expect(result.stats.teams.total).toBeGreaterThanOrEqual(1);
    expect(result.stats.users.total).toBeGreaterThanOrEqual(1);

    const adapter = new LocalDatabaseAdapter(basePath);
    const service = new UnifiedDatabaseService(adapter);
    const procedures = await service.listProcedures();
    const stats = await service.getStats();

    expect(procedures.length).toBeGreaterThanOrEqual(1);
    expect(stats.users.total).toBeGreaterThanOrEqual(1);
  });
});
