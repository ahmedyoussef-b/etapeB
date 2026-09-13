import { teams as defaultTeams } from '../../data/teams';
import { mockProcedures } from '../procedures/mock-data';
import { LocalDatabaseAdapter } from './local-adapter';
import { PathResolver } from './path-resolver';
import { UnifiedDatabaseService, Procedure, Step, Team, User, BlockMeta, EquipmentMeta, GroupMeta, GroupEquipmentMeta } from './unified-database.service';

export type BootstrapSeedUser = Omit<User, 'id' | 'createdAt'> & { id?: string; createdAt?: string };
export type BootstrapSeedTeam = Omit<Team, 'id' | 'createdAt'> & { id?: string; createdAt?: string };
export type BootstrapSeedProcedure = Omit<Procedure, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string };
export type BootstrapSeedBlock = Omit<BlockMeta, 'type'> & { createdAt?: string; updatedAt?: string };
export type BootstrapSeedEquipment = Omit<EquipmentMeta, 'type'> & { block: string; createdAt?: string; updatedAt?: string };
export type BootstrapSeedGroup = Omit<GroupMeta, 'type'> & { createdAt?: string; updatedAt?: string };
export type BootstrapSeedGroupEquipment = Omit<GroupEquipmentMeta, 'type'> & { parentId: string; createdAt?: string; updatedAt?: string };

export interface BootstrapOptions {
  seedTeams?: BootstrapSeedTeam[];
  seedUsers?: BootstrapSeedUser[];
  seedProcedures?: BootstrapSeedProcedure[];
  seedBlocks?: BootstrapSeedBlock[];
  seedEquipment?: BootstrapSeedEquipment[];
  seedGroups?: BootstrapSeedGroup[];
  seedGroupEquipment?: Record<string, BootstrapSeedGroupEquipment[]>;
  force?: boolean;
}

export interface BootstrapResult {
  initialized: boolean;
  basePath: string;
  stats: Awaited<ReturnType<UnifiedDatabaseService['getStats']>>;
}

const PROFESSIONAL_ROLE_MAP: Record<string, User['role']> = {
  chef_de_quart: 'chef-de-quart',
  chef_de_bloc_tg1: 'chef-de-bloc',
  chef_de_bloc_tg2: 'chef-de-bloc',
  rondier_tv: 'rondier',
  rondier_post_gaz: 'rondier',
  rondier_tg1: 'rondier',
  rondier_tg2: 'rondier'
};

function normalizeCategory(value?: string): Procedure['category'] {
  if (!value) return 'Production';
  const normalized = value.toLowerCase();
  if (normalized.includes('maint')) return 'Maintenance';
  if (normalized.includes('séc') || normalized.includes('secur') || normalized.includes('sécur')) return 'Sécurité';
  if (normalized.includes('qual')) return 'Qualité';
  if (normalized.includes('log')) return 'Logistique';
  if (normalized.includes('envir')) return 'Environnement';
  return 'Production';
}

function normalizePriority(value?: string): Procedure['priority'] {
  if (!value) return 'Moyenne';
  const normalized = value.toLowerCase();
  if (normalized.includes('crit')) return 'Critique';
  if (normalized.includes('haute')) return 'Haute';
  if (normalized.includes('basse')) return 'Basse';
  return 'Moyenne';
}

function normalizeStatus(value?: string): Procedure['status'] {
  if (value === 'published' || value === 'archived' || value === 'draft') return value;
  return 'draft';
}

function normalizeStep(step: any, index: number): Step {
  const isRequired = step.isRequired ?? step.isMandatory ?? true;
  const type = step.type ?? 'consigne';
  return {
    id: step.id ?? `step-${index}`,
    title: step.title ?? `Étape ${index + 1}`,
    subtitle: step.subtitle,
    instructions: step.instructions ?? '',
    type: type as Step['type'],
    isRequired,
    isBlocking: step.isBlocking,
    order: step.order ?? index,
    dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
    timer: step.timerEnabled ? step.timerSeconds ?? 0 : step.timer,
    media: Array.isArray(step.media) ? step.media : [],
    alerts: Array.isArray(step.alerts) ? step.alerts : []
  };
}

function normalizeProcedureSeed(seed: any): BootstrapSeedProcedure {
  const metadata = seed.metadata ?? seed;
  const steps = Array.isArray(seed.steps) ? seed.steps : [];

  return {
    id: seed.id,
    title: metadata.title ?? seed.title ?? 'Nouvelle procédure',
    code: metadata.code ?? seed.code ?? `PROC-${Date.now()}`,
    description: metadata.description ?? seed.description,
    category: normalizeCategory(metadata.category ?? seed.category),
    priority: normalizePriority(metadata.priority ?? seed.priority),
    status: normalizeStatus(metadata.status ?? seed.status),
    estimatedDuration: metadata.estimatedTimeMinutes ?? seed.estimatedDuration ?? 10,
    requiredRoles: Array.isArray(metadata.requiredRoles) ? metadata.requiredRoles : (Array.isArray(seed.requiredRoles) ? seed.requiredRoles : []),
    steps: steps.map((step: any, index: number) => normalizeStep(step, index)),
    createdAt: seed.createdAt ?? new Date().toISOString(),
    updatedAt: seed.updatedAt ?? new Date().toISOString(),
    createdBy: metadata.createdBy ?? seed.createdBy,
    metadata: {
      createdBy: metadata.createdBy ?? seed.createdBy,
      source: 'bootstrap'
    }
  };
}

function buildDefaultTeams(): BootstrapSeedTeam[] {
  return defaultTeams.map((team) => ({
    id: `team-${team.id}`,
    name: team.name,
    members: team.members_list.map((member) => `user-${member.id}`),
    leader: `user-${team.members_list[0]?.id ?? 1}`,
    createdAt: new Date().toISOString()
  }));
}

function buildDefaultUsers(): BootstrapSeedUser[] {
  return defaultTeams.flatMap((team) =>
    team.members_list.map((member) => ({
      id: `user-${member.id}`,
      email: member.email,
      name: member.name,
      role: PROFESSIONAL_ROLE_MAP[member.role] ?? 'rondier',
      team: team.name,
      createdAt: new Date().toISOString()
    }))
  );
}

function buildDefaultProcedures(): BootstrapSeedProcedure[] {
  return mockProcedures.map((procedure) => normalizeProcedureSeed(procedure));
}

const DEFAULT_BLOCKS: BootstrapSeedBlock[] = [
  {
    libelle: 'Poste d\'eau et Régulation Turbine',
    code: 'B3'
  }
];

const DEFAULT_EQUIPMENT: BootstrapSeedEquipment[] = [
  { libelle: 'EAU ALIMENTAIRE BASSE PRESSION', code: 'APB', block: 'B3', parentId: 'B3' },
  { libelle: 'EAU ALIMENTAIRE HAUTE PRESSION', code: 'APH', block: 'B3', parentId: 'B3' },
  { libelle: 'EAU CONDENSATION', code: 'ACO', block: 'B3', parentId: 'B3' },
  { libelle: 'ARRET D\'URGENCE', code: 'ADG', block: 'B3', parentId: 'B3' },
  { libelle: 'ARRET PROTECTION', code: 'APB', block: 'B3', parentId: 'B3' },
  { libelle: 'ARRET PROTECTION HAUTE', code: 'APH', block: 'B3', parentId: 'B3' },
  { libelle: 'ARRET RAPIDE', code: 'ARG', block: 'B3', parentId: 'B3' },
  { libelle: 'COMMANDE ALTERNATEUR', code: 'CAP', block: 'B3', parentId: 'B3' },
  { libelle: 'COMMANDE ALTERNATEUR RAPIDE', code: 'CAR', block: 'B3', parentId: 'B3' },
  { libelle: 'CONVERTISSEUR D\'ENERGIE', code: 'CET', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE EXCITATION', code: 'CEX', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE FERROVIAIRE', code: 'CFI', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE JAUGE', code: 'CJK', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE REGULATION', code: 'CRF', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE TURBINE ALTERNATEUR', code: 'CTA', block: 'B3', parentId: 'B3' },
  { libelle: 'CONTROLE VIBRATION', code: 'CVI', block: 'B3', parentId: 'B3' },
  { libelle: 'ECHANGEUR', code: 'ELE', block: 'B3', parentId: 'B3' },
  { libelle: 'FILTRE BASSE PRESSION', code: 'FBP', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ BASSE PRESSION', code: 'GBP', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ EAU VAPEUR', code: 'GEV', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ EAUX', code: 'GEX', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ FUEL', code: 'GFR', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ GAZ', code: 'GGR', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ HAUTE PRESSION', code: 'GHP', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ MOYENNE PRESSION', code: 'GMA', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ PETITE PRESSION', code: 'GPA', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ PRESSION VARIABLE', code: 'GPV', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ REGULATION', code: 'GRA', block: 'B3', parentId: 'B3' },
  { libelle: 'GAZ TURBINE', code: 'GTH', block: 'B3', parentId: 'B3' },
  { libelle: 'HUMIDITE', code: 'HMI', block: 'B3', parentId: 'B3' },
  { libelle: 'HAUTE SECURITE', code: 'HSX', block: 'B3', parentId: 'B3' },
  { libelle: 'KILOWATTHEURE', code: 'KCA', block: 'B3', parentId: 'B3' }
];

const DEFAULT_GROUPS: BootstrapSeedGroup[] = [
  { libelle: 'CHAUDIERE DE RECUPERATION 1', code: 'CHAUDIERE DE RECUPERATION 1' },
  { libelle: 'CHAUDIERE DE RECUPERATION 2', code: 'CHAUDIERE DE RECUPERATION 2' },
  { libelle: 'CONTROSTEAM', code: 'CONTROSTEAM' },
  { libelle: 'DISTRIBUTION ELECTRIQUE', code: 'DISTRIBUTION ELECTRIQUE' },
  { libelle: 'Groupe A', code: 'Groupe A' },
  { libelle: 'Groupe B', code: 'Groupe B' },
  { libelle: 'Groupe C', code: 'Groupe C' },
  { libelle: 'Groupes', code: 'Groupes' },
  { libelle: 'ORDINATEUR DE SUPERVISION - TCI', code: 'ORDINATEUR DE SUPERVISION - TCI' },
  { libelle: 'POSTE D\'EAU', code: 'POSTE D\'EAU' },
  { libelle: 'REGULATION ET CALCULS', code: 'REGULATION ET CALCULS' },
  { libelle: 'SUPERVISION DU BLOC', code: 'SUPERVISION DU BLOC' },
  { libelle: 'TURBINE GAZ 1', code: 'TURBINE GAZ 1' },
  { libelle: 'TURBINE GAZ 2', code: 'TURBINE GAZ 2' },
  { libelle: 'TURBINE VAPEUR', code: 'TURBINE VAPEUR' }
];

const DEFAULT_GROUP_EQUIPMENT: Record<string, BootstrapSeedGroupEquipment[]> = {
  'CHAUDIERE DE RECUPERATION 1': [
    { code: 'B1CR11', libelle: 'VUE GENERALE CR 1', parentId: 'CHAUDIERE DE RECUPERATION 1' },
    { code: 'B1CR21', libelle: 'SYSTEME VAPEUR HP CR 1', parentId: 'CHAUDIERE DE RECUPERATION 1' },
    { code: 'B1CR22', libelle: 'SYSTEME VAPEUR BP CR 1', parentId: 'CHAUDIERE DE RECUPERATION 1' },
    { code: 'B1CR31', libelle: 'TEMPERATURE METAL CHAUDIERE 1', parentId: 'CHAUDIERE DE RECUPERATION 1' }
  ],
  'CHAUDIERE DE RECUPERATION 2': [
    { code: 'B2CR11', libelle: 'VUE GENERALE CR 2', parentId: 'CHAUDIERE DE RECUPERATION 2' },
    { code: 'B2CR21', libelle: 'SYSTEME VAPEUR HP CR 2', parentId: 'CHAUDIERE DE RECUPERATION 2' },
    { code: 'B2CR22', libelle: 'SYSTEME VAPEUR BP CR 2', parentId: 'CHAUDIERE DE RECUPERATION 2' },
    { code: 'B2CR31', libelle: 'TEMPERATURE METAL CHAUDIERE 2', parentId: 'CHAUDIERE DE RECUPERATION 2' }
  ],
  'CONTROSTEAM': [
    { code: 'B3TV41', libelle: 'REGULATION', parentId: 'CONTROSTEAM' },
    { code: 'B3TV42', libelle: 'SECURITEES', parentId: 'CONTROSTEAM' },
    { code: 'B3TV43', libelle: 'CET', parentId: 'CONTROSTEAM' },
    { code: 'B3TV44', libelle: 'INSTRUMENTATION', parentId: 'CONTROSTEAM' },
    { code: 'B3TV45', libelle: 'TEST SECURITES FONDAMENTALES', parentId: 'CONTROSTEAM' },
    { code: 'B3TV46EXP', libelle: 'TESTS VANNES ARRET', parentId: 'CONTROSTEAM' }
  ],
  'DISTRIBUTION ELECTRIQUE': [
    { code: 'B0EL11', libelle: 'DISTRIBUTION ELECTRIQUE 15.5/6.6', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B0EL21', libelle: 'DISTRIBUTION B0LGA', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B0EL22', libelle: 'Groupe électrogène', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B1EL21', libelle: 'DISTRIBUTION B1LGA', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B2EL21', libelle: 'DISTRIBUTION B2LGA', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B3EL21', libelle: 'DISTRIBUTION B3LGA', parentId: 'DISTRIBUTION ELECTRIQUE' },
    { code: 'B3EL22', libelle: 'Distribution courant continu', parentId: 'DISTRIBUTION ELECTRIQUE' }
  ],
  'Groupe A': [
    { code: 'EQ-A1', libelle: 'Équipement A1', parentId: 'Groupe A' },
    { code: 'EQ-A2', libelle: 'Équipement A2', parentId: 'Groupe A' },
    { code: 'EQ-A3', libelle: 'Équipement A3', parentId: 'Groupe A' },
    { code: 'EQ-A4', libelle: 'Équipement A4', parentId: 'Groupe A' },
    { code: 'EQ-A5', libelle: 'Équipement A5', parentId: 'Groupe A' },
    { code: 'EQ-A6', libelle: 'Équipement A6', parentId: 'Groupe A' }
  ],
  'Groupe B': [
    { code: 'EQ-B1', libelle: 'Équipement B1', parentId: 'Groupe B' },
    { code: 'EQ-B2', libelle: 'Équipement B2', parentId: 'Groupe B' },
    { code: 'EQ-B3', libelle: 'Équipement B3', parentId: 'Groupe B' },
    { code: 'EQ-B4', libelle: 'Équipement B4', parentId: 'Groupe B' },
    { code: 'EQ-B5', libelle: 'Équipement B5', parentId: 'Groupe B' },
    { code: 'EQ-B6', libelle: 'Équipement B6', parentId: 'Groupe B' }
  ],
  'Groupe C': [
    { code: 'EQ-C1', libelle: 'Équipement C1', parentId: 'Groupe C' },
    { code: 'EQ-C2', libelle: 'Équipement C2', parentId: 'Groupe C' },
    { code: 'EQ-C3', libelle: 'Équipement C3', parentId: 'Groupe C' },
    { code: 'EQ-C4', libelle: 'Équipement C4', parentId: 'Groupe C' },
    { code: 'EQ-C5', libelle: 'Équipement C5', parentId: 'Groupe C' },
    { code: 'EQ-C6', libelle: 'Équipement C6', parentId: 'Groupe C' }
  ],
  'ORDINATEUR DE SUPERVISION - TCI': [
    { code: 'B0SY11', libelle: 'Vue Système TCI 11', parentId: 'ORDINATEUR DE SUPERVISION - TCI' },
    { code: 'B0SY21', libelle: 'Vue Système TCI 21', parentId: 'ORDINATEUR DE SUPERVISION - TCI' },
    { code: 'B0SY31', libelle: 'Vue Système TCI 31', parentId: 'ORDINATEUR DE SUPERVISION - TCI' },
    { code: 'B0SY32', libelle: 'Vue Système TCI 32', parentId: 'ORDINATEUR DE SUPERVISION - TCI' }
  ],
  'POSTE D\'EAU': [
    { code: 'B3PE11', libelle: 'VUE GENERALE DU POSTE D\'EAU', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE20', libelle: 'Stockage d\'eau déminé', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE21', libelle: 'SYSTEME EXTR EAU CONDENSEUR', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE22', libelle: 'SYSTEME EAU ALIMENTAIRE', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE23', libelle: 'VIDE ET APPOINT CONDENSEUR', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE24', libelle: 'SYSTEME EAU DE CIRCULATION', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE25', libelle: 'SYSTEME EAU DE REFRIGERATION', parentId: 'POSTE D\'EAU' },
    { code: 'B3PE26', libelle: 'RECHAUFFAGE DES CONDENSATS', parentId: 'POSTE D\'EAU' }
  ],
  'REGULATION ET CALCULS': [
    { code: 'B0ASR1', libelle: 'REGULATION DES AUXILIAIRES SITE', parentId: 'REGULATION ET CALCULS' },
    { code: 'B0GN31', libelle: 'CALCULS ECONOMIQUES 1/2', parentId: 'REGULATION ET CALCULS' },
    { code: 'B0GN32', libelle: 'CALCULS ECONOMIQUES 2/2', parentId: 'REGULATION ET CALCULS' },
    { code: 'B0GNR1', libelle: 'REGULATION DU BLOC', parentId: 'REGULATION ET CALCULS' },
    { code: 'B1CRR1', libelle: 'REGULATION CR 1', parentId: 'REGULATION ET CALCULS' },
    { code: 'B2CRR1', libelle: 'REGULATION CR 2', parentId: 'REGULATION ET CALCULS' },
    { code: 'B3PER1', libelle: 'REGULATION POSTE D\'EAU', parentId: 'REGULATION ET CALCULS' }
  ],
  'SUPERVISION DU BLOC': [
    { code: 'B0GN02', libelle: 'Vue Bloc 02', parentId: 'SUPERVISION DU BLOC' },
    { code: 'B0GN11', libelle: 'VUE GENERALE DU BLOC', parentId: 'SUPERVISION DU BLOC' }
  ],
  'TURBINE GAZ 1': [
    { code: 'B1TG11', libelle: 'VUE GENERALE TG 1', parentId: 'TURBINE GAZ 1' },
    { code: 'B1TG21', libelle: 'LUBRIFICATION TG 1', parentId: 'TURBINE GAZ 1' },
    { code: 'B1TG31', libelle: 'VIBRATION ET TEMPERATURE TG 1', parentId: 'TURBINE GAZ 1' },
    { code: 'B1TG32', libelle: 'TEMPERATURE INTER-ROUES TG 1', parentId: 'TURBINE GAZ 1' },
    { code: 'B1TG33', libelle: 'TEMPERATURE ECHAPPEMENT TG 1', parentId: 'TURBINE GAZ 1' }
  ],
  'TURBINE GAZ 2': [
    { code: 'B2TG11', libelle: 'VUE GENERALE TG 2', parentId: 'TURBINE GAZ 2' },
    { code: 'B2TG21', libelle: 'LUBRIFICATION TG 2', parentId: 'TURBINE GAZ 2' },
    { code: 'B2TG31', libelle: 'Synoptique TG2 31', parentId: 'TURBINE GAZ 2' },
    { code: 'B2TG32', libelle: 'Synoptique TG2 32', parentId: 'TURBINE GAZ 2' },
    { code: 'B2TG33', libelle: 'Synoptique TG2 33', parentId: 'TURBINE GAZ 2' }
  ],
  'TURBINE VAPEUR': [
    { code: 'B1TV21', libelle: 'CONTOURNEMENT HP CR 1', parentId: 'TURBINE VAPEUR' },
    { code: 'B1TV22', libelle: 'CONTOURNEMENT BP CR 1', parentId: 'TURBINE VAPEUR' },
    { code: 'B2TV21', libelle: 'CONTOURNEMENT HP CR 2', parentId: 'TURBINE VAPEUR' },
    { code: 'B2TV22', libelle: 'CONTOURNEMENT BP CR 2', parentId: 'TURBINE VAPEUR' },
    { code: 'B3TV11', libelle: 'VUE GENERALE TURBINE A VAPEUR', parentId: 'TURBINE VAPEUR' },
    { code: 'B3TV21', libelle: 'SYSTEME DE PURGES TV', parentId: 'TURBINE VAPEUR' },
    { code: 'B3TV23', libelle: 'SYSTEME HUILE DE REGULATION TV', parentId: 'TURBINE VAPEUR' },
    { code: 'B3TV24', libelle: 'LUBRIFICATION ET SOULEVEMENT TV', parentId: 'TURBINE VAPEUR' },
    { code: 'B3TV31', libelle: 'SURVEILLANCE LIGNE D\'ARBRE TV', parentId: 'TURBINE VAPEUR' }
  ]
};

async function ensureIndustrialStructure(adapter: LocalDatabaseAdapter) {
  const dirs = [
    'Centrale',
    'Centrale/A0',
    'Centrale/B0',
    'Centrale/B1',
    'Centrale/B2',
    'Centrale/B3',
    'Groupes',
    'indexes',
    'registry',
    'registry/items',
    'registry/procedures',
    'registry/ressources humaines',
    'registry/ressources humaines/equipe A',
    'registry/ressources humaines/equipe B',
    'registry/ressources humaines/equipe C',
    'registry/ressources humaines/equipe D',
    'ressources humaines',
    'ressources humaines/equipe A',
    'ressources humaines/equipe B',
    'ressources humaines/equipe C',
    'ressources humaines/equipe D',
    'bank',
    'documents'
  ];

  for (const dir of dirs) {
    const exists = await adapter.exists(dir);
    if (!exists) {
      await adapter.mkdir(dir);
    }
  }

  const files = [
    'mirror_repertoire.json'
  ];

  for (const file of files) {
    const exists = await adapter.exists(file);
    if (!exists) {
      await adapter.writeJSON(file, { initialized: true, createdAt: new Date().toISOString() });
    }
  }
}

export async function initializeLocalDatabase(
  basePath = '.data',
  options: BootstrapOptions = {}
): Promise<BootstrapResult> {
  const adapter = new LocalDatabaseAdapter(basePath);
  const service = new UnifiedDatabaseService(adapter);
  const manifestPath = PathResolver.resolve({ type: 'system', subPath: 'bootstrap-manifest.json' });

  if (!options.force) {
    const manifestExists = await adapter.exists(manifestPath);
    if (manifestExists) {
      const stats = await service.getStats();
      return {
        initialized: true,
        basePath,
        stats
      };
    }
  }

  await ensureIndustrialStructure(adapter);

  const seedTeams = options.seedTeams?.length ? options.seedTeams : buildDefaultTeams();
  const seedUsers = options.seedUsers?.length ? options.seedUsers : buildDefaultUsers();
  const seedProcedures = options.seedProcedures?.length ? options.seedProcedures.map(normalizeProcedureSeed) : buildDefaultProcedures();
  const seedBlocks = options.seedBlocks?.length ? options.seedBlocks : DEFAULT_BLOCKS;
  const seedEquipment = options.seedEquipment?.length ? options.seedEquipment : DEFAULT_EQUIPMENT;
  const seedGroups = options.seedGroups?.length ? options.seedGroups : DEFAULT_GROUPS;
  const seedGroupEquipment = options.seedGroupEquipment?.length ? options.seedGroupEquipment : DEFAULT_GROUP_EQUIPMENT;

  const createdTeams = await Promise.all(seedTeams.map((team) => service.createTeam(team)));
  const createdUsers = await Promise.all(seedUsers.map((user) => service.createUser(user)));
  const createdProcedures = await Promise.all(seedProcedures.map((procedure) => service.createProcedure(procedure)));
  const createdBlocks = await Promise.all(seedBlocks.map((block) => service.upsertBlock(block)));
  const createdEquipment = await Promise.all(seedEquipment.map((eq) => service.upsertEquipment(eq)));
  const createdGroups = await Promise.all(seedGroups.map((group) => service.upsertGroup(group)));

  for (const group of createdGroups) {
    const groupEquipments = seedGroupEquipment[group.code] || [];
    for (const equip of groupEquipments) {
      await service.upsertGroupEquipment(group.code, equip);
    }
  }

  await adapter.writeJSON(manifestPath, {
    initializedAt: new Date().toISOString(),
    basePath,
    teams: createdTeams.length,
    users: createdUsers.length,
    procedures: createdProcedures.length,
    blocks: createdBlocks.length,
    equipment: createdEquipment.length,
    groups: createdGroups.length,
    version: 3
  });

  const stats = await service.getStats();

  return {
    initialized: true,
    basePath,
    stats
  };
}
