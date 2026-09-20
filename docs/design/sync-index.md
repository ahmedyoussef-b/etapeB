# Design — Comparateur permanent de la tree BDD web

## 1. Contexte

Le bouton **"Synchroniser depuis Web"** transfère les fichiers data depuis la BDD web (Vercel/Prisma) vers la BDD locale (`repository/`).

Actuellement, à chaque clic, `SyncService.scanWebFiles()` effectue un **scan complet** de la BDD web :
- 1 requête Prisma `document.findMany()` (tous les documents)
- 7 parcours récursifs `webAdapter.list()` sur les chemins racine (`Centrale`, `Groupes`, `bank`, `documents`, `registry`, `ressources humaines`, `data`)
- Pour chaque fichier découvert : 1 appel `localAdapter.exists()`

Ce scan est **coûteux** et devient de plus en plus lent à mesure que la BDD grossit.

**Objectif** : remplacer ce scan à la volée par la lecture d'un **index permanent** des fichiers attendus dans la BDD web.

---

## 2. Architecture initiale de la tree BDD web

La BDD web possède une **structure attendue** qui peut être reconstruite à partir des tables Prisma :

### 2.1 Fichier de référence existant : `data_repertoire.json`

Le fichier `data_repertoire.json` est la **représentation JSON de l'architecture initiale**. Il est construit dynamiquement par `PrismaAdapter.buildDataRepertoireTree()` (`src/lib/database/prisma-adapter.ts:444`) :

```json
[
  { "name": "bank", "type": "directory", "children": [...] },
  { "name": "Centrale", "type": "directory", "children": [
    { "name": "A0", "type": "directory", "children": [
      { "name": ".meta.json", "type": "file" },
      { "name": "P1", "type": "directory", "children": [...] }
    ]}
  ]},
  { "name": "data_repertoire.json", "type": "file" },
  { "name": "documents", "type": "directory", "children": [...] },
  { "name": "Groupes", "type": "directory", "children": [...] },
  { "name": "mirror_repertoire.json", "type": "file" },
  { "name": "registry", "type": "directory", "children": [] },
  { "name": "system", "type": "directory", "children": [] },
  { "name": "indexes", "type": "directory", "children": [] }
]
```

**Ce fichier n'existe pas physiquement dans `.data/`** — il est généré à la demande par l'API `/api/structure?source=web` via `buildDatabaseTree()`.

### 2.2 Fichier de référence local : `mirror_repertoire.json`

`mirror_repertoire.json` (`src/lib/services/sync/sync.service.ts:278`) stocke le **manifest de la dernière sync** :

```json
{
  "version": "1.0.0",
  "lastSynced": "2024-01-15T10:30:00.000Z",
  "stats": {
    "imported": { "blocks": 5, "equipments": 12, ... },
    "updated": { "blocks": 0, ... },
    "failed": 0
  }
}
```

**Ce n'est pas une liste de fichiers** — c'est un compteur de statistiques.

### 2.3 Conclusion

Il n'existe **aucun fichier de référence physique** qui liste tous les chemins de fichiers data attendus dans la BDD web. L'architecture initiale est **reconstruite dynamiquement** depuis Prisma à chaque requête.

Le comparateur permanent devra donc **créer** cet index.

---

## 3. Coût actuel de `scanWebFiles()`

**Fichier** : `src/lib/services/sync/sync.service.ts:554-591`

### 3.1 Étapes coûteuses

| Étape | Opération | Coût estimé |
|---|---|---|
| 1 | `prisma.document.findMany({ select: { path, filename, data } })` | O(n) où n = nombre total de documents en base |
| 2 | Boucle sur tous les documents + `Buffer.from(doc.data)` | Coût mémoire + CPU |
| 3 | 7× `webAdapter.list()` récursif | 7 requêtes HTTP ou Prisma |
| 4 | Pour chaque fichier découvert : `localAdapter.exists()` | O(m) où m = nombre de fichiers web |

### 3.2 Complexité

- **Pire cas** : O(n + m) où n = documents Prisma, m = fichiers webAdapter
- **Moyen cas** : O(n) si peu de fichiers webAdapter
- **Meilleur cas** : O(1) si l'index existe et est à jour

### 3.3 Impact

- **Premier appel** : lent (scan complet)
- **Appels suivants** : toujours lent (pas de cache)
- **Avec index** : lecture d'un fichier JSON + diff = O(index_size)

---

## 4. Points de maintenance de l'index

La BDD web change quand des fichiers sont créés, modifiés ou supprimés. Voici les points d'écriture identifiés :

### 4.1 Écritures via `prisma.document`

| Fichier | Ligne | Opération |
|---|---|---|
| `src/lib/services/images.service.ts` | 188 | `prisma.document.create()` |
| `src/lib/services/images.service.ts` | 239 | `prisma.document.update()` |
| `src/lib/services/images.service.ts` | 250 | `prisma.document.deleteMany()` |
| `src/lib/procedures/services/procedure-media.service.ts` | 124 | `prisma.document.create()` |
| `src/lib/procedures/services/procedure-media.service.ts` | 171 | `prisma.document.deleteMany()` |
| `src/app/api/procedures/execution/media/route.ts` | 42 | `prisma.document.deleteMany()` |
| `src/app/api/procedures/execution/media/route.ts` | 46 | `prisma.document.deleteMany()` |

### 4.2 Écritures via `webAdapter.delete()` (syncFiles)

| Fichier | Ligne | Opération |
|---|---|---|
| `src/lib/services/sync/sync.service.ts` | 396 | `webAdapter.delete(webFile.path)` — copie |
| `src/lib/services/sync/sync.service.ts` | 450 | `webAdapter.delete(webFile.path)` — dédup |

En mode Prisma (`usePrisma=true`), `webAdapter.delete()` devient `prisma-adapter.delete()` qui exécute des `deleteMany` sur `document`, `block`, `equipment`, `group`, etc.

### 4.3 Conclusion

Il existe **au moins 8 points d'écriture** distincts sur la BDD web. Aucun d'entre eux ne met à jour un index de fichiers.

---

## 5. Mécanismes de cache existants

| Mécanisme | Fichier | Usage |
|---|---|---|
| `mirror_repertoire.json` | `sync.service.ts:278` | Manifest de dernière sync (statistiques) |
| `manifest.json` (dédup) | `sync.service.ts:452` | Historique de déduplication par fichier |
| `system/sync-log.json` | `sync.service.ts:305` | Journal des syncs données |
| `system/sync-files-log.json` | `sync.service.ts:604` | Journal des syncs fichiers |
| `indexes/*.json` | `prisma-adapter.ts` | Indexes de recherche (blocks, equipment, groups, etc.) |

**Aucun de ces mécanismes ne constitue un index de fichiers data** prêt à être consommé par `syncFiles()`.

---

## 6. Choix de stockage de l'index

### 6.1 Options comparées

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Fichier JSON local** (`system/sync-index.json`) | Simple, persistant, versionnable, pas de schéma Prisma | Perdu si corrompu, pas transactionnel |
| **B. Table Prisma** (`syncIndex`) | Interrogeable, transactionnel, partagé entre instances | Coût requête, schéma à migrer, surcharge DB |
| **C. Cache mémoire** | Ultra-rapide | Perdu au redémarrage, non partagé |
| **D. Hybride** (JSON + mémoire) | Rapide + persistant | Complexité de synchronisation mémoire/disk |

### 6.2 Option retenue : **A. Fichier JSON local**

**Justification** :
1. **Simplicité** : pas de migration Prisma, pas de nouvelle table
2. **Performance** : lecture d'un fichier JSON = ~1ms vs requête Prisma = ~10-50ms
3. **Indépendance** : l'index vit avec le repository local, pas avec le cloud
4. **Resilience** : si corrompu, on retombe sur `scanWebFiles()` (fallback)
5. **Cohérence** : `system/sync-log.json` et `mirror_repertoire.json` utilisent déjà le même pattern

**Format retenu** :

```json
{
  "version": "1.0.0",
  "lastRebuild": "2024-01-15T10:30:00.000Z",
  "totalFiles": 142,
  "files": [
    {
      "path": "Centrale/A0/P1/fichier.pdf",
      "name": "fichier.pdf",
      "folder": "Centrale/A0/P1",
      "size": 102400,
      "hash": "sha256:abc123...",
      "source": "document",
      "addedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

**Champs** :
- `path` : chemin complet dans la BDD web
- `name` : nom de fichier
- `folder` : dossier parent
- `size` : taille en octets
- `hash` : SHA-256 du contenu (pour détecter les changements)
- `source` : `document` (Prisma) ou `adapter` (webAdapter.list)
- `addedAt` : date d'ajout dans l'index

---

## 7. Stratégie de maintenance de l'index

### 7.1 Options comparées

| Stratégie | Description | Avantage | Inconvénient |
|---|---|---|---|
| **A. Pull-based** | À chaque sync, comparer l'index au web et mettre à jour | Simple, toujours cohérent | Lent au premier appel |
| **B. Push-based** | Chaque écriture web met à jour l'index | Toujours à jour | Complexe (nécessite de modifier 8+ points) |
| **C. Hybride** | Index mis à jour à chaque sync + rebuild périodique | Robuste | Code plus lourd |
| **D. Refresh manuel** | L'admin rebuild l'index à la demande | Simple | Désynchro possible |

### 7.2 Stratégie retenue : **C. Hybride**

**Principe** :
1. **À chaque sync** : après un pull réussi, l'index est mis à jour avec les fichiers effectivement transférés
2. **À chaque modification web** : l'écriture met à jour l'index si elle est connue (points identifiés §4)
3. **Rebuild automatique** : si l'index est manquant, corrompu, ou âgé de > 24h, `scanWebFiles()` est utilisé en fallback et l'index est reconstruit
4. **Rebuild manuel** : bouton dans la page Supervision pour forcer la reconstruction

**Justification** :
- Le pull-based pur est trop lent au premier appel
- Le push-based nécessite de modifier trop de points (8+)
- L'hybride offre un bon compromis : l'index se construit naturellement au fil des syncs, avec un fallback robuste

---

## 8. Points de mise à jour de l'index

### 8.1 Mise à jour automatique (après sync)

Dans `SyncService.syncFiles()` :

| Action | Mise à jour index |
|---|---|
| Fichier copié | Ajouter l'entrée avec `hash`, `size`, `source: "document"` |
| Fichier dédupliqué | Ajouter l'entrée (identique à copie) |
| Fichier en erreur | **Ne pas ajouter** (reste dans le web) |
| Purge web | **Ne pas supprimer** de l'index (la purge séparée s'en chargera) |

### 8.2 Mise à jour lors des écritures web

| Point d'écriture | Action index |
|---|---|
| `images.service.ts:188` (create) | `upsert` entrée avec `source: "document"` |
| `images.service.ts:239` (update) | `upsert` entrée avec nouveau `hash` |
| `images.service.ts:250` (delete) | `remove` entrée |
| `procedure-media.service.ts:124` (create) | `upsert` entrée |
| `procedure-media.service.ts:171` (delete) | `remove` entrée |
| `procedures/execution/media/route.ts` (delete) | `remove` entrée |
| `sync.service.ts:396,450` (delete après copie) | **Ne pas toucher** (la purge séparée s'en chargera) |

### 8.3 Format de mise à jour

```typescript
interface SyncIndexEntry {
  path: string;
  name: string;
  folder: string;
  size: number;
  hash: string;
  source: 'document' | 'adapter';
  addedAt: string;
}

interface SyncIndex {
  version: string;
  lastRebuild: string;
  totalFiles: number;
  files: SyncIndexEntry[];
}
```

---

## 9. Cas limites

| Cas | Stratégie |
|---|---|
| **Index vide** (premier lancement) | Fallback `scanWebFiles()` + construction de l'index |
| **Index corrompu** (JSON invalide) | Détecter au parse → supprimer → fallback `scanWebFiles()` |
| **Fichier ajouté hors index** | Détecté comme "surplus" lors de la sync → proposer l'ajout à l'index |
| **Fichier supprimé du web** | Présent dans l'index mais absent du web → marqué `orphaned` dans l'index |
| **Fichier renommé** | Ancien chemin absent, nouveau chemin présent → détecté comme suppression + ajout |
| **Conflit de versions** | Le web a changé depuis la dernière sync → `hash` différent dans l'index → re-sync |
| **Index très gros** (>100k entrées) | Lecture streaming du JSON + index mémoire des chemins |
| **Index âgé** (>24h) | Rebuild automatique en arrière-plan |

---

## 10. Liens avec la purge séparée

La feature 7 (purge cloud séparée) dépendra de l'index :

### 10.1 Principe

La purge ne s'appliquera qu'aux fichiers **présents dans l'index**. Cela résout le risque de `deleteMany` massif identifié dans l'audit :

```
Avant : webAdapter.delete(path) pour tout fichier copié → risque de suppression de tables entières
Après : purge ne touche que les fichiers explicitement listés dans l'index
```

### 10.2 Workflow

```
Bouton "Synchroniser depuis Web"
    │
    ├─► Copie fichiers (pas de delete)
    │       │
    │       └─► Met à jour l'index (ajoute les fichiers copiés)
    │
    ▼
Bouton "Purger le cloud" (nouveau)
    │
    ├─► Lit l'index
    ├─► Vérifie que chaque fichier est bien présent en local
    ├─► Supprime uniquement les fichiers de l'index
    │
    └─► Met à jour l'index (retire les fichiers purgés)
```

### 10.3 Avantages

- **Sécurité** : pas de suppression de fichiers hors index
- **Traçabilité** : l'index est la source de vérité de ce qui peut être purgé
- **Réversibilité** : on peut reconstruire l'index si nécessaire

---

## 11. Format de l'index

### 11.1 Fichier JSON

**Chemin** : `system/sync-index.json` (dans le repository local)

**Schéma** :

```json
{
  "version": "1.0.0",
  "lastRebuild": "2024-01-15T10:30:00.000Z",
  "totalFiles": 142,
  "files": [
    {
      "path": "Centrale/A0/P1/fichier.pdf",
      "name": "fichier.pdf",
      "folder": "Centrale/A0/P1",
      "size": 102400,
      "hash": "sha256:abc123...",
      "source": "document",
      "addedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### 11.2 Index mémoire (optionnel)

Pour les gros index (>10k fichiers), charger le fichier JSON en mémoire au démarrage du service :

```typescript
class SyncIndex {
  private entries: Map<string, SyncIndexEntry>;
  
  async load(): Promise<void> {
    const raw = await this.localAdapter.readJSON<SyncIndex>('system/sync-index.json');
    this.entries = new Map(raw.files.map(f => [f.path, f]));
  }
  
  get(path: string): SyncIndexEntry | undefined {
    return this.entries.get(path);
  }
  
  upsert(entry: SyncIndexEntry): void {
    this.entries.set(entry.path, entry);
  }
  
  remove(path: string): void {
    this.entries.delete(path);
  }
  
  async save(): Promise<void> {
    const files = Array.from(this.entries.values());
    await this.localAdapter.writeJSON('system/sync-index.json', {
      version: '1.0.0',
      lastRebuild: new Date().toISOString(),
      totalFiles: files.length,
      files
    });
  }
}
```

---

## 12. Plan d'implémentation

| Sous-étape | Contenu | Effort estimé |
|---|---|---|
| **index.1** | Créer `SyncIndex` class (load/save/upsert/remove) | 1h |
| **index.2** | Implémenter `buildIndexFromWeb()` : scan complet → écriture `system/sync-index.json` | 1h |
| **index.3** | Implémenter `readIndex()` : lecture + validation + fallback si corrompu | 30min |
| **index.4** | Modifier `syncFiles()` : lire l'index au lieu de `scanWebFiles()` | 1h |
| **index.5** | Brancher les points de mise à jour (images, procedure-media, media route) | 2h |
| **index.6** | Ajouter fallback `scanWebFiles()` si index absent/corrompu | 30min |
| **index.7** | Tests unitaires (index vide, corrompu, à jour, désynchronisé) | 1h |

**Effort total estimé** : 7h

---

## 13. Alternatives rejetées

| Alternative | Raison du rejet |
|---|---|
| **Table Prisma `syncIndex`** | Nécessite une migration, surcharge la DB, complexité transactionnelle |
| **Cache mémoire uniquement** | Perdu au redémarrage, ne résout pas le problème du premier appel |
| **Event bus pour push-based** | Nécessite de refactorer 8+ points d'écriture, risque de perte d'events |
| **Rebuild systématique avant chaque sync** | Ne résout pas le problème du coût initial |
| **Utiliser `data_repertoire.json` comme index** | Ce fichier est dynamique, pas une liste de fichiers data, et n'existe pas physiquement dans `.data/` |

---

## 14. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Index corrompu (JSON invalide) | Sync impossible | Fallback `scanWebFiles()` + rebuild automatique |
| Index désynchronisé du web | Fichiers manqués | Rebuild automatique si hash mismatch détecté |
| Performance sur gros index (>100k) | Lenteur lecture | Chargement partiel + cache mémoire |
| Concurrence (plusieurs syncs) | Race condition | Lock fichier `system/sync-index.lock` |
| Oubli de mise à jour sur nouveau point d'écriture | Désynchro silencieuse | Log des modifications non indexées + rebuild auto |

---

## 15. Critères d'acceptation

1. `syncFiles()` lit `system/sync-index.json` au lieu d'appeler `scanWebFiles()` quand l'index est valide
2. L'index est reconstruit automatiquement si absent, corrompu ou âgé de >24h
3. Les écritures web (images, procédures) mettent à jour l'index
4. Un bouton "Rebuild index" est disponible dans la page Supervision
5. La purge séparée (feature 7) ne touche que les fichiers présents dans l'index
6. Tests unitaires couvrant : index vide, corrompu, à jour, désynchronisé
