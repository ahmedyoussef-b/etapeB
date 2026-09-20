# NexaFlow — Couche offline-first

## Vue d'ensemble

La couche offline-first permet à NexaFlow de fonctionner sans connexion internet et de synchroniser automatiquement les données dès que la connexion est rétablie.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  useOfflineEntity / useOfflineSync / SyncStatus             │
├─────────────────────────────────────────────────────────────┤
│                    Sync Engine Layer                        │
│  Queue d'opérations • Pull/Push • Résolution de conflits    │
├─────────────────────────────────────────────────────────────┤
│                    Storage Layer                            │
│  IndexedDB (browser) • Prisma (server) • localStorage       │
└─────────────────────────────────────────────────────────────┘
```

## Composants

### IndexedDB Adapter
**Fichier:** `src/lib/database/indexeddb-adapter.ts`

Stockage local dans le navigateur pour les données opérationnelles.
- `operations` : file d'attente des modifications
- `entities` : cache local des entités
- `metadata` : métadonnées de synchronisation

### Sync Engine
**Fichier:** `src/lib/sync/sync-engine.ts`

Moteur de synchronisation avec :
- File d'opérations (CREATE/UPDATE/DELETE)
- Pull automatique des données distantes
- Push des modifications locales
- Résolution de conflits (LOCAL_WINS, REMOTE_WINS, MERGE)

### React Hooks

#### useOfflineSync
```typescript
const { status, stats, enqueue, sync, getLocalEntities } = useOfflineSync({
  autoSync: true,
  syncInterval: 30000,
});
```

#### useOfflineEntity
```typescript
const { data, loading, create, update, remove, refresh } = useOfflineEntity<Procedure>({
  entity: 'procedures',
  autoLoad: true,
});
```

### UI Components

#### SyncStatus
```typescript
import { SyncStatus } from '@/components/sync/sync-status';

// Dans votre composant
<SyncStatus />
```

Affiche :
- Badge de statut (En ligne / Hors ligne / Synchronisation...)
- Nombre d'opérations en attente
- Bouton de synchronisation manuelle
- Alertes de conflits

## Entités supportées

| Entité | Stockage local | Sync | Fallback |
|--------|---------------|------|----------|
| Procedures | IndexedDB + localStorage | ✅ | server-store |
| Etat-des-lieux | IndexedDB | ✅ | server-store |
| Images | IndexedDB | ✅ | server-store |
| Rapports | IndexedDB | ✅ | localStorage |
| Users | Cache readonly | — | — |
| Blocks/Equipments | Cache readonly | — | — |

## Stratégie de résolution de conflits

Par défaut : **LOCAL_WINS** (les modifications locales sont prioritaires).

Pour changer la stratégie :
```typescript
const engine = new SyncEngine(adapter);
// Stratégie disponible : LOCAL_WINS | REMOTE_WINS | MERGE
```

## API Routes

### POST /api/sync/push
Envoie une opération au serveur.

### GET /api/sync/pull?entity=procedures&since=2024-01-01
Récupère les entités modifiées depuis une date.

## Tests

```bash
# Tests unitaires
npm test -- src/lib/sync/__tests__/
npm test -- src/lib/hooks/__tests__/

# Tests E2E
npm run test:e2e
```

## Configuration

Variables d'environnement optionnelles :
- `SYNC_INTERVAL` : intervalle de sync auto (défaut: 30000ms)
- `SYNC_MAX_RETRIES` : nombre max de tentatives (défaut: 3)
- `SYNC_CONFLICT_STRATEGY` : stratégie de conflit (défaut: LOCAL_WINS)

## Limitations connues

- Les fichiers binaires ne sont pas encore supportés dans IndexedDB
- La synchronisation des images dépend de l'API de upload existante
- Les conflits complexes nécessitent une intervention manuelle

## Améliorations futures

- [ ] Support des fichiers binaires (Blob)
- [ ] Compression des données locales
- [ ] Synchronisation différentielle (delta)
- [ ] Interface de résolution manuelle des conflits
- [ ] Métriques de performance de sync
