import { describe, it, expect } from 'vitest';
import { RBAC_MATRIX, Role } from '../rbac';

describe('RBAC_MATRIX - audit-logs:view (D.2a)', () => {
  it('admin possede audit-logs:view', () => {
    expect(RBAC_MATRIX['admin']).toContain('audit-logs:view');
  });

  it('rondier ne possede PAS audit-logs:view', () => {
    expect(RBAC_MATRIX['rondier']).not.toContain('audit-logs:view');
  });

  it('chef-de-bloc ne possede PAS audit-logs:view', () => {
    expect(RBAC_MATRIX['chef-de-bloc']).not.toContain('audit-logs:view');
  });

  it('chef-de-quart ne possede PAS audit-logs:view', () => {
    expect(RBAC_MATRIX['chef-de-quart']).not.toContain('audit-logs:view');
  });
});

describe('RBAC_MATRIX - non-regression (D.2a)', () => {
  it('admin possede toujours ses permissions historiques', () => {
    const adminPerms = RBAC_MATRIX['admin'];
    expect(adminPerms).toContain('dashboard:view');
    expect(adminPerms).toContain('users:manage');
    expect(adminPerms).toContain('settings:*');
    expect(adminPerms).toContain('logs:view');
    expect(adminPerms).toContain('iot:*');
  });

  it('chaque role a au moins une permission', () => {
    const roles: Role[] = ['rondier', 'chef-de-bloc', 'chef-de-quart', 'admin'];
    for (const role of roles) {
      expect(RBAC_MATRIX[role].length).toBeGreaterThan(0);
    }
  });

  it('les 4 roles sont presents dans la matrice', () => {
    const roles: Role[] = ['rondier', 'chef-de-bloc', 'chef-de-quart', 'admin'];
    for (const role of roles) {
      expect(RBAC_MATRIX).toHaveProperty(role);
    }
  });
});