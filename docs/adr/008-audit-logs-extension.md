# ADR 008 — Extension de la couverture d'audit

- **Date** : 2026-10-02 (création S19) · 2026-10-03 (décisions S20 · documentation S20.1 · implémentation S20.2)
- **Statut** : Accepté (décisions Axe 1→4 tranchées en S20 · implémenté S20.2)
- **Session** : S19 (création) · S20 (décisions) · S20.1 (documentation) · S20.2 (implémentation)
- **Concerne** : audit_logs, couverture d'audit, middleware Prisma, politique de rétention
- **Chantier associé** : S20.2 Chantier D (implémentation audit_logs · ordre prioritaire arrêté)

## Contexte

La table `audit_logs` restait vide depuis le début du projet. Le diagnostic
corrigé (NOTE_AUDIT_LOGS_DIAGNOSTIC.md, S18) établissait que le mécanisme
d'audit n'était pas cassé, mais **incomplet** : seules 3 actions spécifiques
étaient instrumentées.

Couverture avant S20.2 :
- `PROCEDURE_ARCHIVED` — `src/lib/services/procedures.service.ts`
- `PROCEDURE_DELETED` — `src/lib/services/procedures.service.ts`
- `TAURI_TOKEN_FAILED` — `src/app/api/tauri-auth/token/route.ts`

La dette était documentée dans INCIDENT_2026-10-02.md (ligne 137, reformulée
en S19) et dans DB_STATE_2026-10-02.md (snapshot T1 : audit_logs = 0).

### Mise à jour S20 — décisions Axe 1→4 tranchées

La Session 20 a tranché les 4 axes structurants qui bloquaient
l'implémentation de l'extension d'audit. Ces décisions sont documentées
dans la section « Décision » ci-dessous.

**Correspondance Axe (S20) / Question (S19) :**

| Axe S20 | Question S19 | Objet |
|---|---|---|
| **Axe 1** | Q1 | Périmètre : quelles actions auditer ? |
| **Axe 2** | Q2 | Approche : middleware / service / hybride ? |
| **Axe 3** | Q3 | Rétention : TTL sur `audit_logs` ? |
| **Axe 4** | Q4 | Exposition : route admin ? |
| (—) | Q5 | Performance : volume max, purge auto ? — **laissée ouverte** |

**Décisions retenues (résumé) :**

| Axe | Décision | Libellé court |
|---|---|---|
| **Axe 1** | **P1** | Sécurité uniquement (connexions + mutations admin) |
| **Axe 2** | **I2** | Service ciblé (`auditService.log()`) |
| **Axe 3** | **J4** | Rétention 3 ans (cron S21+) |
| **Axe 4** | **K2** | Route API uniquement · `admin` uniquement |

**Implémentation réalisée en S20.2 (chantier D).** Voir section
« Implémentation (S20.2 — réalisée) » ci-dessous.

## Problème

La couverture d'audit initiale (3 actions) était insuffisante pour une
application de production du secteur énergétique.

Actions non couvertes avant S20.2 :
- Connexions / déconnexions.
- Création / modification / suppression d'entités métier (blocks,
  equipments, groups, procedures, documents).
- Actions admin (reset, purge, sync).
- Échecs d'authentification généraux (au-delà de Tauri).

Le truncate systématique dans POST /api/admin/reset efface toute trace
d'audit antérieure, réduisant la rétention à zéro après chaque reset.

## Analyse technique

### Modèle AuditLog

Schéma Prisma complet (schema.prisma, lignes 295-313) :
- Champs : id, userId, action, entity, entityId, before, after,
  ipAddress, userAgent, createdAt.
- Relation : user (User) avec onDelete: SetNull.
- 4 indexes : (entity, entityId), (userId, createdAt), (action, createdAt),
  (createdAt).
- Table SQL : audit_logs.

### Appels existants (avant S20.2)

1. PROCEDURE_ARCHIVED — src/lib/services/procedures.service.ts (ligne ~162)
2. PROCEDURE_DELETED — src/lib/services/procedures.service.ts (ligne ~178)
3. TAURI_TOKEN_FAILED — src/app/api/tauri-auth/token/route.ts (ligne ~45)

### Truncate

POST /api/admin/reset : audit_logs est dans TRUNCATE_ORDER
(src/app/api/admin/reset/route.ts, ligne ~15).

### Limitations (avant S20.2)

- Pas de middleware Prisma pour audit général.
- Pas d'audit sur connexions / mutations admin.
- Pas de rétention configurée (TTL).

## Options

### Option 1 — Middleware Prisma global

Audit systématique de toutes les opérations CRUD sur les entités métier.

Avantages :
- Couverture exhaustive.
- Traçabilité complète.
- Pas d'oubli d'actions critiques.

Inconvénients :
- Impact performance.
- Volume de logs important.
- Complexité de filtrage.

### Option 2 — Service ciblé

Audit explicite dans les services métier pour les actions critiques définies.

Avantages :
- Maîtrise du périmètre.
- Performance préservée.
- Logs pertinents.

Inconvénients :
- Risque d'oubli d'actions critiques.
- Maintenance à chaque nouvelle fonctionnalité.

### Option 3 — Hybride

Middleware pour actions générales (connexions, mutations admin) + service
ciblé pour actions métier spécifiques.

Avantages :
- Équilibre exhaustivité / maîtrise.
- Flexibilité.

Inconvénients :
- Complexité de coordination.
- Double maintenance.

## Décision

**Décisions Axe 1→4 tranchées en S20. Implémentation réalisée en S20.2.**

### Décisions Axe 1→4 (Session 20)

| Axe | Décision | Correspondance ADR | Justification courte |
|---|---|---|---|
| **Axe 1 — Périmètre** | **P1** — Sécurité uniquement | Q1 restreint | Connexions + mutations admin suffisent pour la conformité initiale |
| **Axe 2 — Approche** | **I2** — Service ciblé (`auditService.log()`) | **Option 2** retenue | Maîtrise du périmètre, performance préservée, logs pertinents |
| **Axe 3 — Rétention** | **J4** — 3 ans (cron S21+) | Q3 (TTL) | Conformité secteur énergétique · cron reporté S21 |
| **Axe 4 — Exposition** | **K2** — Route API uniquement · `admin` uniquement | Q4 (route admin) | Pas d'UI admin · API seule, protégée `withAuth(handler, 'audit-logs:view')` |

### Justification

1. **Axe 1 → P1 (Sécurité uniquement)** : le périmètre d'audit est
   **restreint** aux connexions/déconnexions et aux mutations admin.
   L'audit exhaustif des CRUD métier (Option 1 / hybride) est **écarté**
   pour éviter l'impact performance et le volume de logs.
2. **Axe 2 → I2 (Service ciblé)** : l'**Option 2** de l'ADR est retenue.
   Un service dédié `auditService.log()` est créé et appelé
   explicitement aux points d'audit critiques. Les Options 1 (middleware
   global) et 3 (hybride) sont **écartées**.
3. **Axe 3 → J4 (Rétention 3 ans)** : la rétention cible est de **3 ans**,
   cohérente avec les exigences du secteur énergétique. Le **cron de
   purge** est **reporté en S21+** — S20.2 n'implémente **pas** la purge.
4. **Axe 4 → K2 (Route API uniquement, `admin` uniquement)** : une route
   `GET /api/admin/audit-logs` est créée, protégée par
   `withAuth(handler, 'audit-logs:view')`. **Aucune UI admin** n'est livrée.

### Q5 (Performance) — statut

La question Q5 (volume max, purge automatique) **reste ouverte**. Elle
n'est pas bloquante pour l'implémentation S20.2 (service ciblé, faible
volume attendu). Elle sera traitée **en S21+** conjointement avec le
cron de rétention (Axe 3 → J4).

### Truncate `POST /api/admin/reset` — clarification

Le truncate existant dans `POST /api/admin/reset` **reste en place**
(règle de non-régression). Il est **distinct** de la rétention TTL :

- **Truncate** : reset **volontaire** par un admin (opération explicite,
  traçable en amont).
- **TTL / purge** : suppression **automatique** des logs dépassant la
  durée de rétention (3 ans), via cron S21+.

Les deux mécanismes coexistent sans conflit.

## Décisions tranchées (S20) — historique

Les questions Q1→Q5 ouvertes en S19 ont été traitées en S20. Les
questions Q1→Q4 ont donné lieu à des décisions actées (mappées en
Axe 1→4) ; la question Q5 reste ouverte.

| # | Question (rappel S19) | Décision S20 | Statut implémentation |
|---|---|---|---|
| **Q1** | Périmètre d'audit | **P1** — Sécurité uniquement (connexions + mutations admin) | ✅ S20.2 (chantier D — commits 7955b04 à 4420f73) |
| **Q2** | Approche (middleware / service / hybride) | **I2** — Service ciblé (`auditService.log()`) | ✅ S20.2 (chantier D — commit 7d92482) |
| **Q3** | Rétention / TTL | **J4** — 3 ans (cron S21+) | 📋 S21+ (cron) |
| **Q4** | Exposition admin | **K2** — Route API uniquement · `admin` uniquement | ✅ S20.2 (chantier D — commit 4420f73) |
| **Q5** | Performance / purge auto | ⏸️ **Laissée ouverte** | 📋 S21+ |

## Implémentation (S20.2 — réalisée)

### Étape 1 — Validation du périmètre par l'humain

- ✅ **Fait S20** : décisions Axe 1→4 tranchées (P1 / I2 / J4 / K2).
- ⏸️ Q5 (performance) reste ouverte.

### Étape 2 — Implémentation du service d'audit

- ✅ **Fait S20.2 (D.3 — commit 7d92482)**.
- **Approche retenue** : service ciblé (I2).
- `src/lib/services/audit.ts` créé, expose `auditService.log()`.
- Type `AuditAction` (9 actions) + interface `AuditLogInput`.
- Fail-safe (try/catch + `logger.warn`).
- 5 tests unitaires (insert complet, insert minimal, fail-safe silence, fail-safe warning, constantes).

### Étape 2b — Permission RBAC `audit-logs:view`

- ✅ **Fait S20.2 (D.2a — commit 7955b04 · D.2b — commit 8bc0ae9)**.
- Ajoutée à `src/lib/types/rbac.ts` (type `Permission` + `RBAC_MATRIX['admin']`).
- 7 tests RBAC.

### Étape 2c — Instrumentation des points d'appel

- ✅ **Fait S20.2 (D.4a — commit c0fc895 · D.4b — commit 829c191 · D.4c — commit 515049b)**.
- Auth : `LOGIN_SUCCESS`, `LOGIN_FAILED` (cas mauvais password + user inactif), `LOGOUT`.
- Admin : `ADMIN_RESET`, `ADMIN_PURGE`, `ADMIN_SYNC_PURGE`.
- Harmonisation : `PROCEDURE_ARCHIVED`, `PROCEDURE_DELETED`, `TAURI_TOKEN_FAILED` (via `auditService.log()`).

### Étape 3 — Configuration de la rétention

- 📋 **Reporté S21+ (Axe 3 → J4)**.
- Implémenter un cron de purge (3 ans).
- Test de non-régression : vérifier que la purge ne supprime pas les
  logs récents.

### Étape 4 — Exposition admin

- ✅ **Fait S20.2 (D.5 — commit 4420f73)**.
- `GET /api/admin/audit-logs`, protégée `withAuth(handler, 'audit-logs:view')` (K2).
- Pagination `page`/`limit` + 6 filtres (action, entity, entityId, userId, from, to).
- Clamp `limit` à 200 max.
- 5 tests.
- **Pas d'UI admin**.

### Étape 5 — Tests de non-régression

- ✅ **Fait S20.2**.
- Les 3 actions existantes (`PROCEDURE_ARCHIVED`, `PROCEDURE_DELETED`, `TAURI_TOKEN_FAILED`) fonctionnent via `auditService.log()`.
- Le truncate `POST /api/admin/reset` reste fonctionnel.
- Suite de tests globale : 54 + 5 + 5 + 7 = **71 tests** (audit + RBAC + route).

### Étape 6 — Documentation

- ✅ **Fait S20.2 (D.6)**.
- Mise à jour `docs/WORK_GUIDE.md` (D.6c).
- Mise à jour `docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md` (D.6b).
- Mise à jour `docs/adr/008-audit-logs-extension.md` (D.6a — ce fichier).

### Livrables S20.2 (réalisés)

- `src/lib/services/audit.ts` (service `auditService.log()` — D.3)
- 9 points d'appel (3 auth + 3 admin + 3 harmonisés)
- `src/app/api/admin/audit-logs/route.ts` (`GET`, `withAuth(handler, 'audit-logs:view')` — D.5)
- Permission `audit-logs:view` (D.2a)
- Tests unitaires (5 + 7 + 5 = 17 nouveaux tests)
- Documentation mise à jour (D.6)

### Livrables S21+ (rétention)

- Cron de purge 3 ans
- Mesures de performance (Q5)
- UI admin (optionnelle, hors périmètre K2)

## Règles de non-régression

- Conserver les 3 actions existantes : PROCEDURE_ARCHIVED,
  PROCEDURE_DELETED, TAURI_TOKEN_FAILED.
- Ne pas modifier POST /api/admin/reset sans validation explicite de
  l'humain (impact sur la rétention). **Clarification S20** : le truncate
  est un reset volontaire admin, distinct du TTL (cf. section Décision).
- Ne pas ajouter d'appel d'audit dans une boucle critique sans mesure de
  performance.
- Tester après chaque ajout d'action d'audit (unit test + intégration).
- **Ne pas implémenter le cron de purge en S20.2** (reporté S21+).
- **Ne pas créer d'UI admin (S20.2 — K2 = route API uniquement)**.

## Références

- docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md — diagnostic complet (S18).
- docs/INCIDENT_2026-10-02.md — mention initiale « audit_logs toujours
  à 0 » (ligne 137, reformulée S19).
- docs/DB_STATE_2026-10-02.md — snapshot T1, audit_logs = 0.
- docs/adr/007-withauth-async-await.md — format de référence.
- prisma/schema.prisma — modèle AuditLog (lignes 295-313).
- src/lib/services/audit.ts — service `auditService.log()` (S20.2).
- src/lib/services/procedures.service.ts — 2 appels d'audit (lignes 162, 178).
- src/app/api/tauri-auth/token/route.ts — 1 appel d'audit (ligne 45).
- src/app/api/admin/reset/route.ts — truncate audit_logs (ligne 15).
- src/app/api/admin/purge-web/route.ts — appel ADMIN_PURGE (S20.2).
- src/app/api/admin/sync-purge/route.ts — appel ADMIN_SYNC_PURGE (S20.2).
- src/app/api/admin/audit-logs/route.ts — route GET paginée (S20.2).
- src/lib/types/rbac.ts — permission `audit-logs:view` (S20.2).