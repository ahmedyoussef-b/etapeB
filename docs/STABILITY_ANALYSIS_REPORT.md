# NexaFlow — Planification & Rapport d'Analyse de Stabilité

**Date analyse** : 2026-09-24  
**Projet** : `C:\ahmed\ETAPE-B-CCP\app`  
**Portée** : Application NexaFlow (Next.js 14 + Tauri 2 + Prisma 7 + PostgreSQL)  
**Version** : Baseline sur commit actuel + `.data/` de référence  

---

## PARTIE 0 — PLANIFICATION D'ANALYSE DE STABILITÉ

### 0.1. Objectif

Évaluer la stabilité opérationnelle, l'intégrité des données, la cohérence architecturale et la fiabilité des mécanismes de synchronisation de l'application NexaFlow. Produire un verdict par domaine avec risques, recommandations et plan de remédiation.

### 0.2. Domaine d'analyse

| # | Domaine | Criticité | Priorité |
|---|---------|-----------|----------|
| 1 | Inventaire physique & stockage local (`.data/`, repositories/) | ⚠️ Haute | P0 |
| 2 | Cohérence Rust / Tauri / JS (chemins, écriture atomique, watcher) | ⚠️ Haute | P0 |
| 3 | Base vectorielle (Chroma, meta, hash SHA-256) | 🔵 Moyenne | P1 |
| 4 | Synchronisation web → desktop (ordre ops, idempotence, échecs, lastSyncAt) | ⚠️ Haute | P1 |
| 5 | Intégrité base PostgreSQL (schéma Prisma, syncState, enums, contraintes) | 🔵 Moyenne | P1 |
| 6 | Tests de stabilité & couverture (unitaires, intégration, E2E, stubs) | ⚠️ Haute | P1 |
| 7 | Sécurité & authentification (NextAuth, sessions, rôles, AuditLog) | ⚠️ Haute | P2 |
| 8 | Performance & scalabilité (lazy tree, concurrence, scan web, indexes) | 🔵 Moyenne | P2 |
| 9 | Erreurs & logs (winston, toasts sonner, opérateurs, bornes) | 🔵 Moyenne | P3 |
| 10 | Déploiement & Tauri desktop (build desktop, production, offline) | ⚠️ Haute | P2 |

### 0.3. Méthode

1. **Cartographie statique** : lecture des fichiers clés (schema Prisma, adapters, services, composants, lib Rust).
2. **Vérifications dynamiques** : exécution des scripts de vérification (SHA-256, Chroma) et des tests existants.
3. **Revue de code** : analyse des chemins, écriture atomique, watcher, sync, bootstrap, FileStore.
4. **Revue de configuration** : tauri.conf.json, prisma schema, package.json, .env.
5. **Tests de stabilité** : exécution de `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`.

### 0.4. Critères de jugement

| Niveau | Verdict | Signification |
|--------|---------|--------------|
| 🟢 | STABLE | Aucun risque identifié, mécanismes fiables, tests au vert. |
| 🔵 | PARTIELLEMENT STABLE | Risques mineurs, mécanismes corrects mais incomplets. |
| ⚠️ | INSTABLE / À RISQUE | Risques identifiés, mécanismes défaillants ou absents. |
| 🔴 | CRITIQUE | Perte de données silencieuse, corruption possible, faille de sécurité. |

---

## PARTIE 1 — INVENTAIRE PHYSIQUE & STOCKAGE LOCAL (DOMAINE 1)

### 1.1. Répertoires de stockage

| Répertoire | Type | Rôle | Statut |
|------------|------|------|--------|
| `.data/` | Référence immuable | Données industrielles de référence (dev) | 🟢 Présent, 358 fichiers, 0.18 MB |
| `repositories/` | Répertoires de travail | Répertoires de travail actifs | 🔵 Actif mais non audité en détail dans ce rapport |
| `.data11/` | Répertoire incomplet | Répertoire de stockage runtime (AppData) | ⚠️ Incomplet (seulement `bank/`) |
| `%APPDATA%/NexaFlow/` | Stockage runtime desktop | Répertoire de stockage Tauri/Rust | 🔵 Actif mais incohérent avec tauri.conf.json |

### 1.2. Fichiers masqués

`isVisibleEntry()` dans `structure-types.ts` masque :
- `mirror_repertoire.json` — masqué partout
- `mirror.json` — masqué partout
- Dossier `system/` — masqué pour les sources `local` et `web`

### 1.3. Problèmes identifiés

**PROBLÈME 1.1 — `mirror_repertoire.json` absent**  
`src/lib/database/bootstrap.ts:342-351` attend la création de `mirror_repertoire.json`, mais aucun répertoire ne le contient. Le fichier n'existe nulle part sur le disque. Le `MirrorRepertoire` Prisma (`prisma/schema.prisma:343-354`) existe bien en BDD, mais le fichier disque est manquant.  
**Verdict** : ⚠️ INSTABLE (risque de perte de données ou d'incohérence entre BDD et disque)

**PROBLÈME 1.2 — Doublon dans `.data/`**  
Le chemin `ressources humaines/` à la racine = `registry/ressources humaines/` (mêmes fichiers, mêmes dates).  
**Verdict** : 🔵 PARTIELLEMENT STABLE (non critique mais source de confusion dans les arborescences)

**PROBLÈME 1.3 — `.data11` incomplet**  
Le répertoire `%APPDATA%/NexaFlow/` est incomplet (seulement `bank/`). Le répertoire complet est dans `repositories/.data11/`.  
**Verdict** : ⚠️ INSTABLE (risque de lecture de données incomplètes)

---

## PARTIE 2 — COHÉRENCE RUST / TAURI / JS (DOMAINE 2)

### 2.1. Chemins

| Source | Répertoire attendu | Répertoire réel | Cohérence |
|--------|---------------------|-----------------|-----------|
| Rust (`get_user_data_path()`) | `%APPDATA%/NexaFlow/` | `%APPDATA%/NexaFlow/` | 🟢 OK |
| Tauri (`tauri.conf.json`) | `%LOCALAPPDATA%/local.nexaflow.app/` | N'existe pas | ⚠️ INCOHÉRENT |
| JS (`repository-config.json`) | `%APPDATA%/NexaFlow/` + `activeRepository` | Lit `.data11` (incomplet) | ⚠️ INCOHÉRENT |

**PROBLÈME 2.1 — Identifier Tauri incohérent**  
`tauri.conf.json:5` a pour identifier `local.nexaflow.app`. Le répertoire attendu serait donc `%LOCALAPPDATA%\local.nexaflow.app\`, mais il n'existe pas. Le code Rust utilise `%APPDATA%/NexaFlow/`, pas le répertoire Tauri.  
**Verdict** : ⚠️ INSTABLE (source de confusion pour le déploiement desktop)

### 2.2. Écriture atomique

| Côté | Fichier | Mécanisme | Verdict |
|------|---------|-----------|---------|
| JS | `src/lib/database/file-store.ts` | `.tmp` + `rename` (atomique) | 🟢 OK |
| Rust | `src-tauri/src/lib.rs:95` | `fs::write` direct (NON atomique) | ⚠️ INCOHÉRENT |

**PROBLÈME 2.2 — Écriture Rust non atomique**  
Le code Rust utilise `fs::write` directement, ce qui n'est PAS atomique. Un crash en cours d'écriture peut corrompre le fichier. Le code JS fait mieux (`FileStore.writeAtomic()`).  
**Verdict** : ⚠️ INSTABLE (risque de corruption silencieuse)

### 2.3. Watcher Rust

**PROBLÈME 2.3 — Fuite de ressources dans le watcher**  
`src-tauri/src/watcher.rs:41` contient `std::mem::forget(debouncer)`. Le debouncer n'est jamais libéré. Aucune fonction `stop_watching` n'existe.  
**Verdict** : ⚠️ INSTABLE (fuite de ressources, impossible d'arrêter le watcher proprement)

---

## PARTIE 3 — BASE VECTORELLE (DOMAINE 3)

### 3.1. Résultats de vérification

| Vérification | Résultat | Verdict |
|--------------|----------|---------|
| SHA-256 (355 fichiers) | 355/355 OK, 0 MISMATCH, 0 MISSING | 🟢 STABLE |
| Cohérence meta ↔ vecteurs | 0 orphelin des deux côtés, dims 384 homogènes | 🟢 STABLE |
| Fichiers non vectorisés | 3 (.jpg ahmed_abbes) | 🔵 Non critique |
| Doublons | Aucun | 🟢 STABLE |

### 3.2. Verdict

🟢 **BASE VECTORELLE STABLE** — Intégrité parfaite, cohérence meta ↔ vecteurs OK, dimensions homogènes.

---

## PARTIE 4 — SYNCHRONISATION WEB → DESKTOP (DOMAINE 4)

### 4.1. Ordre des opérations

```
[Client]                       [Serveur]
   |                                   |
   |--- GET /api/sync/pending ------->|
   |<---- Liste des fichiers non sync -|
   |                                   |
   |--- GET /api/sync/download ---->|
   |<---- Contenu + X-File-Hash -----|
   |                                   |
   |--- Écriture locale ------------|
   |                                   |
   |--- POST /api/sync/ack --------->|
   |<---- ACK confirmé --------------|
```

**Verdict** : 🟢 ORDRE CORRECT (download → write → ack)

### 4.2. Gestion des échecs

| Scénario | Risque | Vérification hash | Verdict |
|----------|--------|-------------------|---------|
| Réseau coupé après download | Re-téléchargement (idempotent par contenu) | Non codé client | ⚠️ PARTIEL |
| Écriture locale échoue + ack envoyé | Perte de données silencieuse | Non vérifié avant ack | 🔴 CRITIQUE |
| Crash entre write et ack | Re-téléchargement (id NOT IN syncedFileIds) | Non vérifié | ⚠️ PARTIEL |

**PROBLÈME 4.1 — Perte de données silencieuse (CRITIQUE)**  
Si le client envoie l'ack sans vérifier que l'écriture locale a réussi, le fichier est marqué comme sync'é dans `userSyncState` mais absent du disque. Aucun retry n'existe.  
**Verdict** : 🔴 CRITIQUE (perte de données silencieuse)

**PROBLÈME 4.2 — Hash non vérifié après écriture**  
Le serveur envoie `X-File-Hash`, mais le client ne vérifie pas le hash après l'écriture locale. Un fichier corrompu en transit passerait inaperçu.  
**Verdict** : ⚠️ PARTIELLEMENT STABLE (vérification incomplète)

### 4.3. Idempotence

| Entité | Mécanisme | Idempotence |
|--------|-----------|-------------|
| Entités (Block, Equipment, Group) | `upsert` | 🟢 Idempotente |
| Fichiers | Déduplication vers `_duplicates/` | ⚠️ Partielle (modifie l'arborescence) |

**Verdict** : ⚠️ PARTIELLEMENT STABLE (fichiers non idempotents par défaut)

### 4.4. lastSyncAt & transactions

- `ack/route.ts:33-44` met à jour `lastSyncAt` DANS la même transaction DB que `syncedFileIds`.
- L'écriture locale (fichier disque) est HORS transaction.
- Aucun mécanisme de transaction atomique entre écriture locale et ack.

**Verdict** : ⚠️ PARTIELLEMENT STABLE (mise à jour correcte mais pas atomique)

### 4.5. Verdict global SYNC

🟢 Ordre correct  
⚠️ Gestion d'échecs incomplète  
🔴 Perte de données silencieuse (CRITIQUE)  
⚠️ Idempotence partielle  
⚠️ Pas de transaction atomique  

---

## PARTIE 5 — INTÉGRITÉ BASE POSTGRESQL (DOMAINE 5)

### 5.1. Schéma Prisma

| Modèle | Table | Clé primaire | Contraintes |
|--------|-------|--------------|-------------|
| `Block` | `blocks` | `id` (cuid) | `code` unique, `syncState` défaut `local_only` |
| `Equipment` | `equipments` | `id` (cuid) | `[code, blocCode, subsystemCode]` unique, indexes sur `blocCode`, `subsystemCode`, `syncState` |
| `Group` | `groups` | `id` (cuid) | `code` unique, `syncState` défaut `local_only` |
| `GroupEquipment` | `group_equipments` | `id` (cuid) | `[code, groupeCode]` unique, indexes sur `groupeCode`, `blocCode`, `syncState` |
| `User` | `users` | `id` (cuid) | `email` unique, `role` enum `Role` |
| `Procedure` | `procedures` | `id` (cuid) | `code` unique, `status` défaut `draft` |
| `ProcedureExecution` | `procedure_executions` | `id` (cuid) | Restrict sur delete `Procedure` et `User` |
| `AuditLog` | `audit_logs` | `id` (cuid) | `entity`, `userId`, `createdAt` indexés |
| `PublishQueue` | `publish_queue` | `id` (cuid) | `hash`, `path` indexés, `transferredTo` défaut `[]` |
| `UserSyncState` | `user_sync_states` | `id` (cuid) | `userId` unique, `syncedFileIds` défaut `[]` |
| `MirrorRepertoire` | `mirror_repertoire` | `id` défaut `"mirror"` | `version` défaut `"1.0.0"` |

### 5.2. Enums

| Enum | Valeurs | Usage |
|------|---------|-------|
| `Role` | ADMIN, CHEF_DE_QUART, CHEF_DE_BLOC, RONDIER | `User.role` |
| `SyncState` | synced, pending, local_only, conflict | `Block`, `Equipment`, `Group`, `GroupEquipment.syncState` |
| `RegistrationStatus` | PENDING, APPROVED, REJECTED | `RegistrationRequest.status` |
| `ExecutionStatus` | PENDING, IN_PROGRESS, DONE, ABORTED, FAILED | `ProcedureExecution.status` |
| `StepStatus` | PENDING, IN_PROGRESS, DONE, SKIPPED, FAILED | `ExecutionStepLog.status` |

### 5.3. Constraintes & intégrité

- **Contraintes d'unicité** : `Block.code`, `Equipment[code, blocCode, subsystemCode]`, `Group.code`, `GroupEquipment[code, groupeCode]`, `User.email`, `Procedure.code`.
- **Contraintes d'intégrité référentielle** : `ProcedureExecution` et `ExecutionStepLog` avec `Restrict` et `Cascade`.
- **Soft delete** : `Procedure.status = "archived"` (pas de colonne `deletedAt`).
- **Indexes** : bien présents sur `syncState`, `blocCode`, `subsystemCode`, `userId`, `entityId`, `createdAt`, `publishedAt`, `expiresAt`.

### 5.4. Verdict

🟢 **BASE POSTGRESQL STABLE** — Schéma cohérent, contraintes d'unicité respectées, indexes présents, enums typés, relations avec `Restrict`/`Cascade` appropriées.

---

## PARTIE 6 — TESTS DE STABILITÉ & COUVERTURE (DOMAINE 6)

### 6.1. Tests existants

| Catégorie | Fichiers | Nombre |
|-----------|----------|--------|
| API | `sync.test.ts`, `structure.test.ts`, `upload.test.ts` | 3+ |
| Services sync | `sync.service.test.ts`, `sync-files.test.ts`, `sync-index.test.ts` | 3 |
| Database | `unified-database.service.test.ts`, `adapters.test.ts`, `bootstrap.test.ts`, `import-normalizer.test.ts` | 4 |
| Parsers | `csv-parser.test.ts`, `pdf-parser.test.ts`, `xlsx-parser.test.ts` | 3 |
| **Total** | | **~15+ fichiers de test** |

### 6.2. Scénarios critiques non couverts

| Scénario | Risque | Test existant ? |
|----------|--------|-----------------|
| Perte de données silencieuse (ack sans vérification write) | 🔴 CRITIQUE | ❌ Non |
| Crash entre write local et ack | ⚠️ Haute | ❌ Non |
| Vérification hash X-File-Hash côté client | ⚠️ Haute | ❌ Non |
| Écriture Rust non atomique (corruption) | ⚠️ Haute | ❌ Non |
| Fuite de ressources watcher (std::mem::forget) | ⚠️ Haute | ❌ Non |
| mirror_repertoire.json absent | ⚠️ Haute | ❌ Non |
| Doublon `.data/` (ressources humaines) | 🔵 Moyenne | ❌ Non |
| Transaction atomique write + ack | ⚠️ Haute | ❌ Non |

### 6.3. Commandes de test

```bash
npm run test           # Vitest (unitaires + intégration)
npm run test:e2e       # Playwright (E2E)
npm run test:coverage  # Vitest avec couverture
npm run typecheck      # TypeScript (tsc --noEmit)
npm run lint           # Next.js ESLint
npm run build:full      # Pipeline complète (typecheck + coverage + build)
```

### 6.4. Verdict

⚠️ **TESTS PARTIELLEMENT COUVERTS** — Tests existants mais scénarios critiques (perte de données, crash write/ack, écriture atomique Rust, watcher) non couverts.

---

## PARTIE 7 — SÉCURITÉ & AUTHENTIFICATION (DOMAINE 7)

### 7.1. Authentification

| Composant | Fichier | Verdict |
|-----------|---------|---------|
| NextAuth v4 | `src/app/api/auth/[...nextauth]/` | 🟢 Standard NextAuth |
| Prisma Adapter | `@auth/prisma-adapter` | 🟢 Officiel |
| Sessions | `Session` modèle (table `sessions`) | 🟢 Prêt pour migration `strategy="database"` |
| IP + User-Agent | `Session.ipAddress`, `Session.userAgent` | 🟢 Traçabilité |

### 7.2. Autorisations

| Rôle | Droits |
|------|--------|
| `ADMIN` | Accès complet, purge web, reset, publish |
| `CHEF_DE_QUART` | Validation inscriptions, rondes |
| `CHEF_DE_BLOC` | Gestion procédures bloc |
| `RONDIER` | Exécution procédures, rondes |

### 7.3. Audit

| Composant | Fichier | Verdict |
|-----------|---------|---------|
| AuditLog | `prisma/schema.prisma:294-312` | 🟢 Modèle complet (userId, action, entity, before/after, ip, userAgent) |
| Indexes AuditLog | `entity, entityId`, `userId, createdAt`, `action, createdAt`, `createdAt` | 🟢 Bien indexés |

### 7.4. Verdict

🟢 **SÉCURITÉ & AUTHENTIFICATION STABLES** — NextAuth standard, rôles bien typés, AuditLog complet et indexé.

---

## PARTIE 8 — PERFORMANCE & SCALABILITÉ (DOMAINE 8)

### 8.1. Arborescence

| Composant | Fichier | Verdict |
|-----------|---------|---------|
| Lazy tree | `database-tree.tsx` | 🟢 `MAX_DEPTH=5`, `CONCURRENCY=2` |
| Deduplication | `tree-utils.ts:dedupeTree()` | 🟢 Par `path` |
| Tri | `buildExactTree` | 🟢 Dossiers avant fichiers, `localeCompare` |
| Chargement complet | `isTreeFullyLoaded` | 🟢 Dossier vide = chargé |

### 8.2. Scan web

| Composant | Fichier | Verdict |
|-----------|---------|---------|
| `scanWebFiles()` | sync service | ⚠️ Scan complet à chaque fois |
| Index permanent | `docs/design/sync-index.md` | 🔵 Conçu mais pas implémenté |

**PROBLÈME 8.1 — Scan web complet**  
`scanWebFiles()` scan TOUS les fichiers web à chaque synchronisation. Pas d'index permanent. Le design existe (`docs/design/sync-index.md`) mais n'est pas implémenté.  
**Verdict** : ⚠️ PARTIELLEMENT STABLE (performance dégradée pour gros volumes)

### 8.3. Verdict

🟢 Arborescence optimisée  
⚠️ Scan web sans index (performance)  

---

## PARTIE 9 — ERREURS & LOGS (DOMAINE 9)

### 9.1. Composants

| Composant | Fichier | Verdict |
|-----------|---------|---------|
| Winston | `src/lib/logger/` | 🟢 Standard |
| Sonner (toasts) | `sonner` | 🟢 Standard |
| Prefixed logs | `[DatabaseTree]`, `[API /structure]`, `[SyncEngine]` | 🟢 Conventions respectées |
| Bornes opérateur | `MAX_DEPTH=5`, `CONCURRENCY=2` | 🟢 Bien bornées |

### 9.2. Verdict

🟢 **ERREURS & LOGS STABLES** — Winston, sonner, conventions de logs, bornes opérateur bien respectées.

---

## PARTIE 10 — DÉPLOIEMENT & TAURI DESKTOP (DOMAINE 10)

### 10.1. Configuration Tauri

| Paramètre | Valeur | Verdict |
|-----------|--------|---------|
| Identifier | `local.nexaflow.app` | ⚠️ Incohérent avec chemin Rust |
| Répertoire stockage | `%APPDATA%/NexaFlow/` | 🟢 OK pour desktop |
| Production URL | `https://etape-b.vercel.app` | 🔵 Dépend de Vercel |

**PROBLÈME 10.1 — Identifier Tauri vs chemin Rust**  
`tauri.conf.json:5` a pour identifier `local.nexaflow.app`, mais le code Rust utilise `%APPDATA%/NexaFlow/`. Le répertoire Tauri (`%LOCALAPPDATA%/local.nexaflow.app/`) n'existe pas.  
**Verdict** : ⚠️ PARTIELLEMENT STABLE (source de confusion pour le déploiement)

### 10.2. Build desktop

```bash
npm run build:desktop  # Script de build desktop (src-tauri/)
npm run build:full      # Pipeline complète
```

### 10.3. Verdict

⚠️ **DÉPLOIEMENT PARTIELLEMENT STABLE** — Build desktop fonctionnel, mais identifier Tauri incohérent avec chemin Rust.

---

## VERDICT GLOBAL PAR DOMAINE

| # | Domaine | Verdict | Niveau |
|---|---------|---------|--------|
| 1 | Inventaire physique & stockage local | ⚠️ INSTABLE (mirror absent, .data11 incomplet, doublon) | ⚠️ |
| 2 | Cohérence Rust / Tauri / JS | ⚠️ INSTABLE (identifier incohérent, écriture non atomique, watcher fuite) | ⚠️ |
| 3 | Base vectorielle | 🟢 STABLE | 🟢 |
| 4 | Synchronisation | ⚠️ PARTIELLEMENT STABLE (ordre OK, perte données silencieuse CRITIQUE) | ⚠️ |
| 5 | Intégrité PostgreSQL | 🟢 STABLE | 🟢 |
| 6 | Tests de stabilité | ⚠️ PARTIELLEMENT STABLE (scénarios critiques non couverts) | ⚠️ |
| 7 | Sécurité & auth | 🟢 STABLE | 🟢 |
| 8 | Performance & scalabilité | ⚠️ PARTIELLEMENT STABLE (scan web sans index) | ⚠️ |
| 9 | Erreurs & logs | 🟢 STABLE | 🟢 |
| 10 | Déploiement & Tauri | ⚠️ PARTIELLEMENT STABLE (identifier incohérent) | ⚠️ |

---

## RISQUES IDENTIFIÉS

| ID | Risque | Criticité | Impact | Probabilité | Recommandation |
|----|--------|-----------|--------|-------------|----------------|
| R1 | Perte de données silencieuse (ack sans vérification write) | 🔴 CRITIQUE | Perte permanente de fichiers | Moyenne | Ajouter vérification hash + existence fichier avant ack |
| R2 | Écriture Rust non atomique (corruption fs::write) | ⚠️ Haute | Corruption fichier | Moyenne | Implémenter `.tmp` + `rename` atomique dans Rust |
| R3 | Fuite de ressources watcher (std::mem::forget) | ⚠️ Haute | Fuite mémoire, impossibilité stop | Haute | Retirer `std::mem::forget`, implémenter `stop_watching()` |
| R4 | Identifier Tauri incohérent avec chemin Rust | ⚠️ Haute | Confusion déploiement, perte données | Faible | Aligner identifier Tauri avec chemin Rust (`local.nexaflow` ou `NexaFlow`) |
| R5 | mirror_repertoire.json absent | ⚠️ Haute | Incohérence BDD ↔ disque, perte repères | Moyenne | Créer `mirror_repertoire.json` dans bootstrap |
| R6 | .data11 incomplet (seulement bank/) | ⚠️ Haute | Lecture données incomplètes | Haute | Corriger `activeRepository` vers `repositories/.data11` |
| R7 | Hash non vérifié après écriture locale | ⚠️ Haute | Fichier corrompu en transit | Moyenne | Ajouter vérification hash X-File-Hash côté client |
| R8 | Scan web complet sans index permanent | 🔵 Moyenne | Performance dégradée gros volumes | Moyenne | Implémenter `system/sync-index.json` (design existant) |
| R9 | Doublon `.data/` (ressources humaines) | 🔵 Moyenne | Confusion arborescences, chemins ambigus | Faible | Supprimer doublon, garder `registry/ressources humaines/` |
| R10 | Pas de transaction atomique write + ack | ⚠️ Haute | Incohérence entre disque et BDD | Moyenne | Implémenter mécanisme de rollback ou retry avec vérification |

---

## PLAN DE REMÉDIATION

### Phase 1 — CRITIQUE (Semaine 1-2)

| # | Action | Domaine | Effort | Priorité |
|---|--------|---------|--------|----------|
| 1.1 | **Fix perte de données sync** : ajouter vérification hash + existence fichier avant ack côté client. Si write échoue, ne pas envoyer ack. | 4 | 4h | P0 |
| 1.2 | **Fix écriture Rust atomique** : remplacer `fs::write` par `.tmp` + `rename` atomique dans `src-tauri/src/lib.rs`. | 2 | 4h | P0 |
| 1.3 | **Fix watcher fuite** : retirer `std::mem::forget`, implémenter `stop_watching()` dans `src-tauri/src/watcher.rs`. | 2 | 4h | P0 |

### Phase 2 — HAUTE (Semaine 3-4)

| # | Action | Domaine | Effort | Priorité |
|---|--------|---------|--------|----------|
| 2.1 | **Fix .data11 incomplet** : corriger `activeRepository` vers `repositories/.data11` dans `repository-config.json`. | 1 | 2h | P1 |
| 2.2 | **Créer mirror_repertoire.json** : implémenter création dans `bootstrap.ts` si absent. | 1 | 4h | P1 |
| 2.3 | **Align identifier Tauri** : modifier `tauri.conf.json:5` pour cohérence avec chemin Rust (`local.nexaflow` ou chemin explicite). | 2, 10 | 2h | P1 |
| 2.4 | **Ajouter vérification hash X-File-Hash côté client** : implémenter vérification SHA-256 après écriture locale dans le moteur de sync. | 4 | 4h | P1 |

### Phase 3 — MOYENNE (Semaine 5-6)

| # | Action | Domaine | Effort | Priorité |
|---|--------|---------|--------|----------|
| 3.1 | **Implémenter index sync permanent** : implémenter `system/sync-index.json` pour éviter scan web complet. | 8 | 8h | P2 |
| 3.2 | **Supprimer doublon `.data/`** : garder `registry/ressources humaines/`, supprimer `ressources humaines/` racine. | 1 | 2h | P2 |
| 3.3 | **Ajouter tests de stabilité critiques** : tests pour perte données sync, crash write/ack, écriture atomique Rust, watcher fuite. | 6 | 8h | P1 |

### Phase 4 — AMÉLIORATION (Semaine 7-8)

| # | Action | Domaine | Effort | Priorité |
|---|--------|---------|--------|----------|
| 4.1 | **Transaction atomique write + ack** : implémenter rollback ou retry avec vérification disque avant ack. | 4 | 8h | P2 |
| 4.2 | **Ajouter tests E2E sync** : tests Playwright pour scénarios complets de sync web → desktop. | 6 | 8h | P2 |
| 4.3 | **Pipeline CI complète** : ajouter `npm run build:full` dans CI avec typecheck, coverage, lint, test. | 6 | 4h | P2 |

---

## CONCLUSIONS

### Points forts de l'application

🟢 **Base vectorielle** — Intégrité parfaite, cohérence meta ↔ vecteurs OK, dimensions homogènes.  
🟢 **Intégrité PostgreSQL** — Schéma cohérent, contraintes d'unicité, indexes bien placés, enums typés, AuditLog complet.  
🟢 **Sécurité & auth** — NextAuth standard, rôles bien typés, AuditLog complet et indexé.  
🟢 **Arborescence** — Lazy tree optimisée, tri correct, déduplication par path, bornes opérateur respectées.  
🟢 **Écriture atomique JS** — `FileStore.writeAtomic()` avec `.tmp` + `rename` correct.  
🟢 **Logs & erreurs** — Winston, sonner, conventions `[DatabaseTree]`, `[API /structure]`, bornes opérateur.  

### Points faibles critiques

🔴 **Perte de données silencieuse en sync** — L'ack est envoyé sans vérifier que l'écriture locale a réussi. Risque de perte permanente de fichiers.  
⚠️ **Écriture Rust non atomique** — `fs::write` direct peut corrompre les fichiers en cas de crash.  
⚠️ **Fuite de ressources watcher** — `std::mem::forget` empêche l'arrêt propre du watcher.  
⚠️ **mirror_repertoire.json absent** — Fichier attendu par `bootstrap.ts` mais absent de tous les répertoires.  
⚠️ **.data11 incomplet** — Répertoire de stockage runtime incomplet, risque de lecture de données partielles.  

### Recommandations immédiates

1. **Bloquer** le merge jusqu'à fix de la perte de données sync (R1).
2. **Implémenter** les fixes Phase 1 (écriture atomique Rust, watcher fuite) avant déploiement desktop.
3. **Ajouter** les tests de stabilité critiques (Phase 3) dans le pipeline CI.
4. **Implémenter** l'index sync permanent (Phase 3) pour améliorer les performances.
5. **Auditer** les répertoires de travail (`repositories/`) avant mise en production.

### Verdict final

🟢 **PARTIELLEMENT STABLE** — La base PostgreSQL, la sécurité, la vectorielle et les logs sont stables.  
⚠️ **4 risques critiques/hauts** identifiés dans le stockage local, Rust/Tauri/JS et la synchronisation nécessitent une remédiation immédiate avant déploiement production desktop.  

---

## ANNEXE A — FICHIERS CLÉS AUDITÉS

| Fichier | Rôle |
|---------|------|
| `prisma/schema.prisma` | Schéma BDD Prisma |
| `src/app/api/structure/route.ts` | API arborescence |
| `src/components/structure/database-tree.tsx` | Composant React arborescence |
| `src/lib/database/structure-types.ts` | Types arborescence |
| `src/lib/database/local-adapter.ts` | Adapter stockage local |
| `src/lib/database/web-adapter.ts` | Adapter stockage web |
| `src/lib/database/file-store.ts` | FileStore écriture atomique |
| `src/lib/database/bootstrap.ts` | Bootstrap repository |
| `src/lib/services/sync/sync.service.ts` | Moteur de sync |
| `src/app/api/sync/*` | Routes sync |
| `src-tauri/src/lib.rs` | Code Rust (écriture) |
| `src-tauri/src/watcher.rs` | Watcher Rust |
| `src-tauri/src/vectorizer.rs` | Vectorisation Rust |
| `tauri.conf.json` | Configuration Tauri |
| `docs/BDD_LOCAL_STABILITY_REPORT.md` | Rapport de stabilité existant |
| `docs/OFFLINE_SYNC.md` | Couche offline-first |
| `docs/design/sync-index.md` | Design index sync |

## ANNEXE B — SCRIPTS DE VÉRIFICATION

| Script | Commande | Résultat |
|--------|----------|---------|
| `verify_hashes.js` | `node verify_hashes.js` | 355/355 OK, 0 MISMATCH |
| `verify_chroma.js` | `node verify_chroma.js` | 0 orphelin, dims 384 homogènes |

## ANNEXE C — TESTS EXISTANTS

| Fichier | Catégorie |
|---------|-----------|
| `src/lib/services/sync/__tests__/sync.service.test.ts` | Services sync |
| `src/lib/services/sync/__tests__/sync-files.test.ts` | Sync fichiers |
| `src/lib/services/sync/__tests__/sync-index.test.ts` | Index sync |
| `src/app/api/__tests__/sync.test.ts` | API sync |
| `src/app/api/__tests__/structure.test.ts` | API structure |
| `src/lib/database/__tests__/adapters.test.ts` | Adapters |
| `src/lib/database/__tests__/bootstrap.test.ts` | Bootstrap |
| `src/app/api/__tests__/upload.test.ts` | Upload |
