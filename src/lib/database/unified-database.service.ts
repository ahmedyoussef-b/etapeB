import crypto from 'crypto';
import { StorageAdapter } from './storage-adapter';
import { LocalDatabaseAdapter } from './local-adapter';
import { WebDatabaseAdapter } from './web-adapter';
import { PathResolver, DataPath } from './path-resolver';
import { IndexManager } from './index-manager';
import { StorageError } from './storage-adapter';

export interface BlockMeta {
  libelle: string;
  code: string;
  type: 'centrale';
  syncState?: string;
}

export interface EquipmentMeta {
  libelle: string;
  code: string;
  type: 'sous_centrale';
  parentId?: string | null;
  syncState?: string;
}

export interface GroupMeta {
  libelle: string;
  code: string;
  type: 'groupe';
  syncState?: string;
}

export interface GroupEquipmentMeta {
  libelle: string;
  code: string;
  type: 'groupe';
  parentId: string;
  syncState?: string;
}

export interface Procedure {
  id: string;
  title: string;
  code?: string;
  description?: string;
  category?: 'Production' | 'Maintenance' | 'Sécurité' | 'Qualité' | 'Logistique' | 'Environnement';
  priority?: 'Basse' | 'Moyenne' | 'Haute' | 'Critique';
  status: 'draft' | 'published' | 'archived';
  estimatedDuration?: number;
  requiredRoles?: string[];
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface Step {
  id: string;
  title: string;
  subtitle?: string;
  instructions: string;
  type: 'consigne' | 'saisie' | 'inspection' | 'validation' | 'mesure';
  isRequired: boolean;
  isBlocking?: boolean;
  order: number;
  dependencies?: string[];
  timer?: number;
  media?: MediaFile[];
  alerts?: Alert[];
}

export interface MediaFile {
  id: string;
  filename: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'signature';
  mimeType: string;
  size: number;
  url?: string;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'DANGER' | 'WARNING' | 'INFO' | 'SECURITY_CHECK';
  message: string;
  condition?: string;
  threshold?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'chef-de-quart' | 'chef-de-bloc' | 'rondier';
  team?: string;
  createdAt: string;
  lastLogin?: string;
  preferences?: Record<string, any>;
}

export interface Team {
  id: string;
  name: string;
  members: string[];
  leader?: string;
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'sent' | 'archived';
  attachments: MediaFile[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export class UnifiedDatabaseService {
  private adapter: StorageAdapter;
  private indexManager: IndexManager;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
    this.indexManager = new IndexManager(adapter);
  }

  // ============ BLOCS / ÉQUIPEMENTS ============

  async upsertBlock(data: Omit<BlockMeta, 'type'>): Promise<BlockMeta> {
    const blockPath = PathResolver.resolve(PathResolver.getBlockPath(data.code));
    await this.adapter.writeJSON(blockPath, {
      libelle: data.libelle,
      code: data.code,
      type: 'centrale',
      syncState: 'local_only'
    });

    return { libelle: data.libelle, code: data.code, type: 'centrale', syncState: 'local_only' };
  }

  async getBlock(code: string): Promise<BlockMeta | null> {
    try {
      const blockPath = PathResolver.resolve(PathResolver.getBlockPath(code));
      return await this.adapter.readJSON<BlockMeta>(blockPath);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listBlocks(): Promise<BlockMeta[]> {
    const results: BlockMeta[] = [];
    try {
      const entries = await this.adapter.list('Centrale');
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const block = await this.getBlock(entry);
        if (block) results.push(block);
      }
    } catch {}
    return results;
  }

  async upsertEquipment(data: Omit<EquipmentMeta, 'type'> & { block: string }): Promise<EquipmentMeta> {
    const now = new Date().toISOString();
    const metaPath = PathResolver.resolve(PathResolver.getEquipmentPath(data.block, data.code));
    const { block: _block, ...equipmentData } = data;

    let existing: EquipmentMeta | null = null;
    try {
      existing = await this.adapter.readJSON<EquipmentMeta>(metaPath);
    } catch (error) {
      if (!(error instanceof StorageError && error.code === 'NOT_FOUND')) {
        throw error;
      }
    }

    const equipment: EquipmentMeta = {
      ...existing,
      ...equipmentData,
      type: 'sous_centrale',
      syncState: existing?.syncState || 'local_only'
    };

    await this.adapter.writeJSON(metaPath, equipment);

    return equipment;
  }

  async getEquipment(block: string, equipmentCode: string): Promise<EquipmentMeta | null> {
    try {
      const metaPath = PathResolver.resolve(PathResolver.getEquipmentPath(block, equipmentCode));
      return await this.adapter.readJSON<EquipmentMeta>(metaPath);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listEquipment(filters?: { block?: string; parentId?: string; search?: string }): Promise<EquipmentMeta[]> {
    const results: EquipmentMeta[] = [];
    try {
      const blocks = await this.listEquipmentBlocks(filters?.block);
      for (const blockCode of blocks) {
        const blockDir = PathResolver.resolve(PathResolver.getBlockPath(blockCode));
        try {
          const entries = await this.adapter.list(blockDir);
          for (const entry of entries) {
            if (entry === '.meta.json' || entry.startsWith('.')) continue;
            try {
              const equipment = await this.getEquipment(blockCode, entry);
              if (equipment) {
                if (filters?.search) {
                  const searchLower = filters.search.toLowerCase();
                  if (!equipment.libelle?.toLowerCase().includes(searchLower) &&
                      !equipment.code?.toLowerCase().includes(searchLower)) {
                    continue;
                  }
                }
                results.push(equipment);
              }
            } catch {}
          }
        } catch {}
      }
    } catch {}
    return results;
  }

  private async listEquipmentBlocks(filterBlock?: string): Promise<string[]> {
    if (filterBlock) return [filterBlock];
    try {
      const entries = await this.adapter.list('Centrale');
      return entries.filter(e => !e.startsWith('.'));
    } catch {
      return [];
    }
  }

  async deleteEquipment(block: string, equipmentCode: string): Promise<boolean> {
    const exists = await this.getEquipment(block, equipmentCode);
    if (!exists) return false;

    const metaPath = PathResolver.resolve(PathResolver.getEquipmentPath(block, equipmentCode));
    await this.adapter.delete(metaPath).catch(() => {});

    return true;
  }

  async upsertGroup(data: Omit<GroupMeta, 'type'>): Promise<GroupMeta> {
    const groupPath = PathResolver.resolve(PathResolver.getGroupPath(data.code));

    let existing: GroupMeta | null = null;
    try {
      existing = await this.adapter.readJSON<GroupMeta>(groupPath);
    } catch (error) {
      if (!(error instanceof StorageError && error.code === 'NOT_FOUND')) {
        throw error;
      }
    }

    const group: GroupMeta = {
      ...existing,
      ...data,
      type: 'groupe',
      syncState: existing?.syncState || 'local_only'
    };

    await this.adapter.writeJSON(groupPath, group);

    return group;
  }

  async getGroup(code: string): Promise<GroupMeta | null> {
    try {
      const groupPath = PathResolver.resolve(PathResolver.getGroupPath(code));
      return await this.adapter.readJSON<GroupMeta>(groupPath);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listGroups(filters?: { search?: string }): Promise<GroupMeta[]> {
    const results: GroupMeta[] = [];
    try {
      const entries = await this.adapter.list('Groupes');
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        try {
          const group = await this.getGroup(entry);
          if (group) {
            if (filters?.search) {
              const searchLower = filters.search.toLowerCase();
              if (!group.libelle?.toLowerCase().includes(searchLower) &&
                  !group.code?.toLowerCase().includes(searchLower)) {
                continue;
              }
            }
            results.push(group);
          }
        } catch {}
      }
    } catch {}
    return results;
  }

  async upsertGroupEquipment(groupName: string, data: Omit<GroupEquipmentMeta, 'type'> & { parentId: string }): Promise<GroupEquipmentMeta> {
    const equipPath = PathResolver.resolve(PathResolver.getGroupEquipmentPath(groupName, data.code));

    let existing: GroupEquipmentMeta | null = null;
    try {
      existing = await this.adapter.readJSON<GroupEquipmentMeta>(equipPath);
    } catch (error) {
      if (!(error instanceof StorageError && error.code === 'NOT_FOUND')) {
        throw error;
      }
    }

    const equipment: GroupEquipmentMeta = {
      ...existing,
      ...data,
      type: 'groupe',
      syncState: existing?.syncState || 'local_only'
    };

    await this.adapter.writeJSON(equipPath, equipment);

    return equipment;
  }

  async getGroupEquipment(groupName: string, equipmentCode: string): Promise<GroupEquipmentMeta | null> {
    try {
      const equipPath = PathResolver.resolve(PathResolver.getGroupEquipmentPath(groupName, equipmentCode));
      return await this.adapter.readJSON<GroupEquipmentMeta>(equipPath);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listGroupEquipment(groupName: string): Promise<GroupEquipmentMeta[]> {
    const results: GroupEquipmentMeta[] = [];
    const groupDir = PathResolver.resolve(PathResolver.getGroupPath(groupName));

    try {
      const entries = await this.adapter.list(groupDir);
      for (const entry of entries) {
        if (entry === '.meta.json') continue;
        const equip = await this.getGroupEquipment(groupName, entry);
        if (equip) results.push(equip);
      }
    } catch {
      // directory doesn't exist
    }

    return results;
  }

  async listGroupEquipments(): Promise<{ group: string; equipment: GroupEquipmentMeta }[]> {
    const groups = await this.listGroups();
    const results: { group: string; equipment: GroupEquipmentMeta }[] = [];
    for (const group of groups) {
      const items = await this.listGroupEquipment(group.code);
      for (const equipment of items) {
        results.push({ group: group.code, equipment });
      }
    }
    return results;
  }

  async getStructureTree(): Promise<{
    blocks: BlockMeta[];
    equipmentByBlock: Record<string, EquipmentMeta[]>;
    groups: GroupMeta[];
    groupEquipment: Record<string, GroupEquipmentMeta[]>;
  }> {
    const blocks = await this.listBlocks();
    const equipmentByBlock: Record<string, EquipmentMeta[]> = {};
    const groupEquipment: Record<string, GroupEquipmentMeta[]> = {};

    for (const block of blocks) {
      equipmentByBlock[block.code] = await this.listEquipment({ block: block.code });
    }

    const groups = await this.listGroups();
    for (const group of groups) {
      groupEquipment[group.code] = await this.listGroupEquipment(group.code);
    }

    return {
      blocks,
      equipmentByBlock,
      groups,
      groupEquipment
    };
  }

  // ============ PROCEDURES ============

  async createProcedure(data: Omit<Procedure, 'id' | 'createdAt' | 'updatedAt'>): Promise<Procedure> {
    const procedure: Procedure = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: data.steps.map((step, index) => ({
        ...step,
        id: step.id || crypto.randomUUID(),
        order: step.order ?? index
      }))
    };

    const procPath = PathResolver.resolve(PathResolver.getProcedurePath(procedure.id, 'metadata.json'));
    await this.adapter.writeJSON(procPath, {
      id: procedure.id,
      title: procedure.title,
      code: procedure.code,
      category: procedure.category,
      priority: procedure.priority,
      status: procedure.status,
      estimatedDuration: procedure.estimatedDuration,
      requiredRoles: procedure.requiredRoles,
      createdAt: procedure.createdAt,
      updatedAt: procedure.updatedAt,
      createdBy: procedure.createdBy,
      metadata: procedure.metadata
    });

    const stepsPath = PathResolver.resolve(PathResolver.getProcedurePath(procedure.id, 'steps.json'));
    await this.adapter.writeJSON(stepsPath, procedure.steps);

    await this.indexManager.updateIndex('procedures', {
      id: procedure.id,
      title: procedure.title,
      code: procedure.code,
      category: procedure.category,
      status: procedure.status,
      priority: procedure.priority,
      updatedAt: procedure.updatedAt
    });

    return procedure;
  }

  async upsertProcedure(data: Omit<Procedure, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<Procedure> {
    const now = new Date().toISOString();
    const procPath = PathResolver.resolve(PathResolver.getProcedurePath(data.id, 'metadata.json'));
    const stepsPath = PathResolver.resolve(PathResolver.getProcedurePath(data.id, 'steps.json'));

    const metadata = {
      id: data.id,
      title: data.title,
      code: data.code,
      category: data.category,
      priority: data.priority,
      status: data.status,
      estimatedDuration: data.estimatedDuration,
      requiredRoles: data.requiredRoles,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      createdBy: data.createdBy,
      metadata: data.metadata
    };

    await this.adapter.writeJSON(procPath, metadata);
    await this.adapter.writeJSON(stepsPath, data.steps);

    await this.indexManager.updateIndex('procedures', {
      id: data.id,
      title: data.title,
      code: data.code,
      category: data.category,
      status: data.status,
      priority: data.priority,
      updatedAt: metadata.updatedAt
    });

    return {
      ...data,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt
    };
  }

  async getProcedure(id: string): Promise<Procedure | null> {
    try {
      const procPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'metadata.json'));
      const metadata = await this.adapter.readJSON<any>(procPath);

      if (!metadata) return null;

      const stepsPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'steps.json'));
      const steps = await this.adapter.readJSON<Step[]>(stepsPath) || [];

      return {
        id: metadata.id,
        title: metadata.title,
        code: metadata.code,
        category: metadata.category,
        priority: metadata.priority,
        status: metadata.status,
        estimatedDuration: metadata.estimatedDuration,
        requiredRoles: metadata.requiredRoles,
        steps,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        createdBy: metadata.createdBy,
        metadata: metadata.metadata
      };
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listProcedures(filters?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
  }): Promise<Procedure[]> {
    const index = await this.indexManager.getIndex('procedures');

    let items = index.items;

    if (filters?.status) {
      items = items.filter(item => item.status === filters.status);
    }
    if (filters?.category) {
      items = items.filter(item => item.category === filters.category);
    }
    if (filters?.priority) {
      items = items.filter(item => item.priority === filters.priority);
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(item =>
        item.title?.toLowerCase().includes(searchLower) ||
        item.code?.toLowerCase().includes(searchLower)
      );
    }

    const procedures: Procedure[] = [];
    for (const item of items) {
      const procedure = await this.getProcedure(item.id);
      if (procedure) {
        procedures.push(procedure);
      }
    }

    return procedures;
  }

  async updateProcedure(id: string, data: Partial<Procedure>): Promise<Procedure | null> {
    const existing = await this.getProcedure(id);
    if (!existing) return null;

    const updated: Procedure = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    };

    const procPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'metadata.json'));
    await this.adapter.writeJSON(procPath, {
      id: updated.id,
      title: updated.title,
      code: updated.code,
      category: updated.category,
      priority: updated.priority,
      status: updated.status,
      estimatedDuration: updated.estimatedDuration,
      requiredRoles: updated.requiredRoles,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      createdBy: updated.createdBy,
      metadata: updated.metadata
    });

    if (data.steps) {
      const stepsPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'steps.json'));
      await this.adapter.writeJSON(stepsPath, updated.steps);
    }

    await this.indexManager.updateIndex('procedures', {
      id: updated.id,
      title: updated.title,
      code: updated.code,
      category: updated.category,
      status: updated.status,
      priority: updated.priority,
      updatedAt: updated.updatedAt
    });

    return updated;
  }

  async deleteProcedure(id: string): Promise<boolean> {
    const exists = await this.getProcedure(id);
    if (!exists) return false;

    const procPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'metadata.json'));
    const stepsPath = PathResolver.resolve(PathResolver.getProcedurePath(id, 'steps.json'));

    await this.adapter.delete(procPath).catch(() => {});
    await this.adapter.delete(stepsPath).catch(() => {});

    await this.indexManager.removeFromIndex('procedures', id);

    return true;
  }

  // ============ USERS ============

  async upsertUser(data: Omit<User, 'createdAt'> & { id: string; createdAt?: string }): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      ...data,
      createdAt: data.createdAt || now
    };

    const path = PathResolver.resolve(PathResolver.getUserPath(user.id, 'profile.json'));
    await this.adapter.writeJSON(path, user);

    await this.indexManager.updateIndex('users', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team: user.team
    });

    return user;
  }

  async listUsers(): Promise<User[]> {
    const index = await this.indexManager.getIndex('users');
    const users: User[] = [];
    for (const item of index.items) {
      const user = await this.getUser(item.id);
      if (user) users.push(user);
    }
    return users;
  }

  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    };

    const path = PathResolver.resolve(PathResolver.getUserPath(user.id, 'profile.json'));
    await this.adapter.writeJSON(path, user);

    await this.indexManager.updateIndex('users', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      team: user.team
    });

    return user;
  }

  async getUser(id: string): Promise<User | null> {
    try {
      const path = PathResolver.resolve(PathResolver.getUserPath(id, 'profile.json'));
      return await this.adapter.readJSON<User>(path);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const index = await this.indexManager.getIndex('users');
    const entry = index.items.find(item => item.email === email);
    if (!entry) return null;
    return this.getUser(entry.id);
  }

  // ============ TEAMS ============

  async upsertTeam(data: Omit<Team, 'createdAt'> & { id: string; createdAt?: string }): Promise<Team> {
    const now = new Date().toISOString();
    const team: Team = {
      ...data,
      createdAt: data.createdAt || now
    };

    const path = PathResolver.resolve(PathResolver.getTeamPath(team.id, 'info.json'));
    await this.adapter.writeJSON(path, team);

    await this.indexManager.updateIndex('teams', {
      id: team.id,
      name: team.name,
      members: team.members.length,
      leader: team.leader
    });

    return team;
  }

  async listTeams(): Promise<Team[]> {
    const index = await this.indexManager.getIndex('teams');
    const teams: Team[] = [];
    for (const item of index.items) {
      const team = await this.getTeam(item.id);
      if (team) teams.push(team);
    }
    return teams;
  }

  async createTeam(data: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
    const team: Team = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    };

    const path = PathResolver.resolve(PathResolver.getTeamPath(team.id, 'info.json'));
    await this.adapter.writeJSON(path, team);

    await this.indexManager.updateIndex('teams', {
      id: team.id,
      name: team.name,
      members: team.members.length,
      leader: team.leader
    });

    return team;
  }

  async getTeam(id: string): Promise<Team | null> {
    try {
      const path = PathResolver.resolve(PathResolver.getTeamPath(id, 'info.json'));
      return await this.adapter.readJSON<Team>(path);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  // ============ REPORTS ============

  async createReport(data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    const report: Report = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const path = PathResolver.resolve(PathResolver.getReportPath(report.id, 'data.json'));
    await this.adapter.writeJSON(path, report);

    await this.indexManager.updateIndex('reports', {
      id: report.id,
      title: report.title,
      status: report.status,
      createdAt: report.createdAt
    });

    return report;
  }

  async getReport(id: string): Promise<Report | null> {
    try {
      const path = PathResolver.resolve(PathResolver.getReportPath(id, 'data.json'));
      return await this.adapter.readJSON<Report>(path);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async listReports(filters?: { status?: string; search?: string }): Promise<Report[]> {
    const index = await this.indexManager.getIndex('reports');

    let items = index.items;

    if (filters?.status) {
      items = items.filter(item => item.status === filters.status);
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(item =>
        item.title?.toLowerCase().includes(searchLower)
      );
    }

    const reports: Report[] = [];
    for (const item of items) {
      const report = await this.getReport(item.id);
      if (report) {
        reports.push(report);
      }
    }

    return reports;
  }

  // ============ MÉTHODES UTILITAIRES ============

  async getStats(): Promise<{
    procedures: { total: number; byStatus: Record<string, number> };
    users: { total: number };
    teams: { total: number };
    reports: { total: number; byStatus: Record<string, number> };
    blocks: { total: number };
    equipment: { total: number; byBlock: Record<string, number> };
    groups: { total: number };
    storage: { files: number; size: number };
  }> {
    const procIndex = await this.indexManager.getIndex('procedures');
    const userIndex = await this.indexManager.getIndex('users');
    const teamIndex = await this.indexManager.getIndex('teams');
    const reportIndex = await this.indexManager.getIndex('reports');

    const byStatus = (items: any[]) => {
      return items.reduce((acc: Record<string, number>, item) => {
        const status = item.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
    };

    const blocks = await this.listBlocks();
    const allEquipment = await this.listEquipment();
    const groups = await this.listGroups();

    const byBlock: Record<string, number> = {};
    for (const eq of allEquipment) {
      const block = eq.parentId || 'unknown';
      byBlock[block] = (byBlock[block] || 0) + 1;
    }

    const stats = await this.adapter.getStats?.();

    return {
      procedures: {
        total: procIndex.total,
        byStatus: byStatus(procIndex.items)
      },
      users: { total: userIndex.total },
      teams: { total: teamIndex.total },
      reports: {
        total: reportIndex.total,
        byStatus: byStatus(reportIndex.items)
      },
      blocks: { total: blocks.length },
      equipment: {
        total: allEquipment.length,
        byBlock
      },
      groups: { total: groups.length },
      storage: stats || { files: 0, size: 0 }
    };
  }

  async search(query: string): Promise<{
    procedures: Procedure[];
    users: User[];
    reports: Report[];
    equipment: EquipmentMeta[];
    groups: GroupMeta[];
  }> {
    const searchLower = query.toLowerCase();

    const procedures = await this.listProcedures({ search: query });
    const userPromises = (await this.indexManager.getIndex('users')).items
      .filter(item =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.email?.toLowerCase().includes(searchLower)
      )
      .map(item => this.getUser(item.id));
    const users = (await Promise.all(userPromises)).filter((u): u is User => u !== null);

    const reports = await this.listReports({ search: query });
    const equipment = await this.listEquipment({ search: query });
    const allGroups = await this.listGroups({ search: query });

    return {
      procedures,
      users,
      reports,
      equipment,
      groups: allGroups
    };
  }

  // ============ MIGRATION ============

  async migrateFromLegacy(data: {
    procedures?: any[];
    reports?: any[];
    media?: any[];
  }): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;

    if (data.procedures) {
      for (const proc of data.procedures) {
        try {
          await this.createProcedure(proc);
          migrated++;
        } catch (error) {
          console.error('Erreur migration procédure:', error);
          failed++;
        }
      }
    }

    return { migrated, failed };
  }
}
