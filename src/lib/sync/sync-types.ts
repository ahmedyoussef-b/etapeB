export type EntityType = 'blocks' | 'equipments' | 'groups' | 'groupEquipments' | 'procedures' | 'users' | 'teams';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperation {
  id: string;
  type: OperationType;
  entity: EntityType;
  entityId: string;
  data: any;
  timestamp: number;
  status: 'PENDING' | 'SYNCED' | 'CONFLICT';
  retryCount: number;
  lastError?: string;
}

export interface SyncQueueStats {
  pending: number;
  synced: number;
  conflicts: number;
  total: number;
}

export interface ConflictResolution {
  strategy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE';
  mergedData?: any;
}

export interface SyncEngineOptions {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  conflictStrategy?: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE';
}
