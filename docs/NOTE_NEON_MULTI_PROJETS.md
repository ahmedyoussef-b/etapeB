# Note technique — Projets Neon et vérification avant action BDD

## 1. Contexte et objectif

Cette note documente la situation des projets Neon au 2026-10-02 et formalise
la procédure de vérification à appliquer avant toute action BDD (migration,
ALTER TABLE, reset, purge).

Elle fait suite à l'incident S17 où un `ALTER TABLE` a été exécuté sur le
mauvais projet Neon (`riadh5college` au lieu de `etapeB`).

## 2. Constat — Un seul projet Neon actif

Au 2026-10-02, un seul projet Neon est actif et utilisé par NexaFlow :

| Projet | Statut |
|---|---|
| **`etapeB` / `production` / `neondb`** | **Seul projet actif — cible NexaFlow** |
| `riadh5college` | Supprimé volontairement après S17 |
| `ccp-etapeB` | Supprimé volontairement (projet obsolète) |
| `AllConnect` | Projet tiers, intact |
| `neon-aureolin-ferry` | Autre organisation, intact |
| `ahmed2` / `ahmedbddlocale` | Projet de test/documentation |

**Conséquence** : le risque de confusion multi-projets est structurellement
éliminé pour NexaFlow. La procédure de vérification reste néanmoins obligatoire
par prudence.

## 3. Identification du projet `etapeB`

### 3.1 Critères d'identification

| Critère | Valeur attendue |
|---|---|
| **Hostname** | `ep-wild-truth-axxruzqa-pooler.c-4.us-east-2.aws.neon.tech` |
| **Base** | `neondb` |
| **Branche** | `production` |
| **Région** | AWS US East 2 (Ohio) |
| **Schéma Prisma** | 20+ tables (voir §3.2) |
| **Migrations appliquées** | 13 au 2026-10-01 (16 au 2026-10-02, session 18) |

### 3.2 Tables attendues

Modèles avec `@@map` explicite :

| Modèle Prisma | Table SQL |
|---|---|
| Block | blocks |
| Equipment | equipments |
| Group | groups |
| GroupEquipment | group_equipments |
| User | users |
| Session | sessions |
| RegistrationRequest | registration_requests |
| Procedure | procedures |
| ProcedureMedia | procedure_media |
| ProcedureExecution | procedure_executions |
| ExecutionStepLog | execution_step_logs |
| AuditLog | audit_logs |
| Team | teams |
| SyncLog | sync_logs |
| MirrorRepertoire | mirror_repertoire |
| IndexRecord | indexes |
| Report | reports |
| Document | documents |
| HumanResource | human_resources |
| DocumentChunk | document_chunks |

Modèles SANS `@@map` :

| Modèle Prisma | Table SQL réelle |
|---|---|
| PublishQueue | "PublishQueue" |
| UserSyncState | "UserSyncState" |
| SystemVersion | "SystemVersion" |

### 3.3 Snapshot de référence T0 (2026-10-01)

| table_name | row_count | total_size |
|---|---|---|
| documents | 7 | 4848 kB |
| equipments | 255 | 288 kB |
| indexes | 7 | 224 kB |
| group_equipments | 61 | 144 kB |
| procedures | 1 | 96 kB |
| reports | 0 | 96 kB |
| audit_logs | 0 | 96 kB |
| groups | 11 | 80 kB |
| blocks | 5 | 80 kB |
| PublishQueue | 0 | 80 kB |
| SystemVersion | 0 | 64 kB |
| UserSyncState | 0 | 64 kB |
| users | 5 | 64 kB |
| procedure_media | 0 | 48 kB |
| procedure_executions | 0 | 48 kB |
| sessions | 0 | 40 kB |
| execution_step_logs | 0 | 40 kB |
| mirror_repertoire | 1 | 32 kB |
| _prisma_migrations | 13 | 32 kB |
| registration_requests | 0 | 32 kB |
| human_resources | 0 | 32 kB |
| teams | 0 | 24 kB |
| sync_logs | 0 | 16 kB |

Total : ~7 Mo (dont 4,7 Mo dans `documents`).

**Note :** ce snapshot date du 2026-10-01. Depuis, `document_chunks` a été
créé (S11, RAG opérationnel) et peuplé (S18, 252 chunks). Le snapshot de
référence actuel (T1) sera réalisé en session 19+.

## 4. Procédure de vérification avant toute action BDD

**Règle d'or** : aucune action BDD (migration, ALTER TABLE, reset, purge)
ne doit être exécutée sans avoir vérifié l'ensemble des étapes ci-dessous.

### Étape 1 — Vérification du hostname

Vérifier que `DATABASE_URL` ou `DIRECT_URL` pointe vers le hostname attendu :

```
ep-wild-truth-axxruzqa-pooler.c-4.us-east-2.aws.neon.tech
```

**Ne jamais exécuter de commande Prisma si le hostname diffère.**

### Étape 2 — Vérification `information_schema`

Se connecter à la base et vérifier la présence des tables NexaFlow :

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

La liste doit correspondre aux 20+ tables attendues (§3.2).

### Étape 3 — Vérification `_prisma_migrations`

```sql
SELECT COUNT(*) AS migration_count
FROM _prisma_migrations;
```

Résultat attendu : **13 au 2026-10-01, 16 au 2026-10-02 (session 18).**

### Étape 4 — Vérification du snapshot

```sql
SELECT COUNT(*) AS user_count FROM users;
```

Résultat attendu : **5** (snapshot T0).

```sql
SELECT COUNT(*) AS chunk_count FROM document_chunks;
```

Résultat attendu : **252** (au 2026-10-02, session 18).

Vérifier également que `documents` contient 7 lignes et `equipments` 255
lignes pour confirmer qu'il s'agit bien de la base de production.

### Étape 5 — Capture dashboard Neon

Avant toute action de modification :
1. Ouvrir le dashboard Neon (console.neon.tech).
2. Vérifier le nom du projet : **`etapeB`**.
3. Vérifier la branche : **`production`**.
4. Vérifier la base : **`neondb`**.
5. Capture d'écran recommandée pour traçabilité.

## 5. Règle de sécurité

- **Vérification visuelle obligatoire** du projet Neon (nom + branche + base)
  avant chaque commande SQL de modification.
- **Aucune action BDD sans vérification préalable** de l'ensemble des étapes
  de la section 4.
- **En cas de doute** : arrêt immédiat et signalement au superviseur.
- **Ne jamais émettre de feu vert** — rôle réservé au superviseur.

## 6. Références

- `docs/INCIDENT_2026-10-02.md` — incident S17, détails de l'ALTER TABLE sur
  mauvais projet.
- `docs/DB_STATE_2026-10-01.md` — snapshot T0, cartographie tables.
- `docs/adr/006-prisma-pgvector-hnsw-structural-debt.md` — vérification
  obligatoire du projet Neon cible avant toute migration manuelle HNSW.
- Session 18 — investigation menée par l'IA interne.

## 7. Mises à jour à prévoir

- **`docs/DB_STATE_2026-10-01.md` §6.4** : obsolète. Le paragraphe indique
  que `DocumentChunk` est orphelin (0 table en base). Depuis S11 (RAG
  opérationnel, ADR 003) et S18 (252 chunks), `document_chunks` est actif.
  Mettre à jour ou créer un `DB_STATE_2026-10-02.md` en session 19+.
- **Snapshot T1** : à réaliser dans 1-2 semaines pour comparer avec T0 et
  détecter d'éventuelles dérives de volume.

## 8. Historique des projets Neon

| Date | Projet | Action | Motif |
|---|---|---|
| S17 (2026-10-02) | `riadh5college` | Supprimé volontairement | Projet tiers erroné, colonne `active` ajoutée par erreur |
| S17 (2026-10-02) | `ccp-etapeB` | Supprimé volontairement | Projet obsolète |
| 2026-10-02 | `etapeB` | Seul projet actif | Cible NexaFlow |

Cette section documente l'historique pour mémoire. Si un second projet
réapparaît en session 19+, cette note servira de référence pour éviter
toute confusion.
