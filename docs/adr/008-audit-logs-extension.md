# ADR 008 — Extension de la couverture d'audit

- **Date** : 2026-10-02 (création S19) · 2026-10-03 (décisions S20 · documentation S20.1)
- **Statut** : Accepté (décisions Axe 1→4 tranchées en S20 · implémentation en cours S20.1)
- **Session** : S19 (création) · S20 (décisions) · S20.1 (documentation + implémentation)
- **Concerne** : audit_logs, couverture d'audit, middleware Prisma, politique de rétention
- **Chantier associé** : S20.1 Bloc 2.3 (implémentation audit_logs · ordre prioritaire arrêté)

## Contexte

La table `audit_logs` reste vide depuis le début du projet. Le diagnostic
corrigé (NOTE_AUDIT_LOGS_DIAGNOSTIC.md, S18) établit que le mécanisme
d'audit n'est pas cassé, mais **incomplet** : seules 3 actions spécifiques
sont instrumentées.

Couverture actuelle :
- `PROCEDURE_ARCHIVED` — `src/lib/services/procedures.service.ts`
- `PROCEDURE_DELETED` — `src/lib/services/procedures.service.ts`
- `TAURI_TOKEN_FAILED` — `src/app/api/tauri-auth/token/route.ts`

La dette est documentée dans INCIDENT_2026-10-02.md (ligne 137, reformulée
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

**Implémentation planifiée S20.1 (chantier D).** Voir section « Plan
d'implémentation (S20.1) » ci-dessous.

## Problème

La couverture d'audit actuelle (3 actions) est insuffisante pour une
application de production du secteur énergétique.

Actions non couvertes :
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

### Appels existants

1. PROCEDURE_ARCHIVED — src/lib/services/procedures.service.ts (ligne ~162)
2. PROCEDURE_DELETED — src/lib/services/procedures.service.ts (ligne ~178)
3. TAURI_TOKEN_FAILED — src/app/api/tauri-auth/token/route.ts (ligne ~45)

### Truncate

POST /api/admin/reset : audit_logs est dans TRUNCATE_ORDER
(src/app/api/admin/reset/route.ts, ligne ~15).

### Limitations

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

**Décisions Axe 1→4 tranchées en S20. Implémentation planifiée S20.1.**

### Décisions Axe 1→4 (Session 20)

| Axe | Décision | Correspondance ADR | Justification courte |
|---|---|---|---|
| **Axe 1 — Périmètre** | **P1** — Sécurité uniquement | Q1 restreint | Connexions + mutations admin suffisent pour la conformité initiale |
| **Axe 2 — Approche** | **I2** — Service ciblé (`auditService.log()`) | **Option 2** retenue | Maîtrise du périmètre, performance préservée, logs pertinents |
| **Axe 3 — Rétention** | **J4** — 3 ans (cron S21+) | Q3 (TTL) | Conformité secteur énergétique · cron reporté S21 |
| **Axe 4 — Exposition** | **K2** — Route API uniquement · `admin` uniquement | Q4 (route admin) | Pas d'UI admin en S20.1 · API seule, protégée `withAuth(['admin'])` |

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
   purge** est **reporté en S21+** — S20.1 n'implémente **pas** la purge.
4. **Axe 4 → K2 (Route API uniquement, `admin` uniquement)** : une route
   `GET /api/admin/audit-logs` est créée, protégée par
   `withAuth(['admin'])`. **Aucune UI admin** n'est livrée en S20.1.

### Q5 (Performance) — statut

La question Q5 (volume max, purge automatique) **reste ouverte**. Elle
n'est pas bloquante pour l'implémentation S20.1 (service ciblé, faible
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
| **Q1** | Périmètre d'audit | **P1** — Sécurité uniquement (connexions + mutations admin) | 📋 S20.1 (chantier D) |
| **Q2** | Approche (middleware / service / hybride) | **I2** — Service ciblé (`auditService.log()`) | 📋 S20.1 (chantier D) |
| **Q3** | Rétention / TTL | **J4** — 3 ans (cron S21+) | 📋 S21+ (cron) |
| **Q4** | Exposition admin | **K2** — Route API uniquement · `admin` uniquement | 📋 S20.1 (chantier D) |
| **Q5** | Performance / purge auto | ⏸️ **Laissée ouverte** | 📋 S21+ |

## Plan d'implémentation (S20.1)

### Étape 1 — Validation du périmètre par l'humain

- ✅ **Fait S20** : décisions Axe 1→4 tranchées (P1 / I2 / J4 / K2).
- ⏸️ Q5 (performance) reste ouverte.

### Étape 2 — Implémentation du service d'audit

- 📋 **À faire S20.1 (chantier D)**.
- **Approche retenue** : service ciblé (I2).
- Créer `src/lib/services/audit.ts` exposant `auditService.log()`.
- Ajouter les ~8 points d'appel (connexions + mutations admin), selon
  le périmètre P1.

### Étape 3 — Configuration de la rétention

- 📋 **Reporté S21+ (Axe 3 → J4)**.
- Implémenter un cron de purge (3 ans).
- Test de non-régression : vérifier que la purge ne supprime pas les
  logs récents.

### Étape 4 — Exposition admin

- 📋 **À faire S20.1 (chantier D)**.
- Créer `GET /api/admin/audit-logs`, protégée `withAuth(['admin'])` (K2).
- **Pas d'UI admin** en S20.1.

### Étape 5 — Tests de non-régression

- 📋 **À faire S20.1**.
- Vérifier que les 3 actions existantes (`PROCEDURE_ARCHIVED`,
  `PROCEDURE_DELETED`, `TAURI_TOKEN_FAILED`) continuent de fonctionner.
- Vérifier que le truncate `POST /api/admin/reset` reste fonctionnel.

### Étape 6 — Documentation

- 📋 **À faire S20.1**.
- Mettre à jour `docs/WORK_GUIDE.md` (section 7 BDD/Neon) avec les
  nouvelles règles d'audit.
- Mettre à jour `docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md` avec le statut
  « implémenté ».

### Livrables S20.1 (cible)

- `src/lib/services/audit.ts` (service `auditService.log()`)
- ~8 points d'appel (connexions + mutations admin)
- `src/app/api/admin/audit-logs/route.ts` (`GET`, `withAuth(['admin'])`)
- Tests unitaires + intégration
- Documentation mise à jour

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
- **Ne pas implémenter le cron de purge en S20.1** (reporté S21+).
- **Ne pas créer d'UI admin en S20.1** (K2 = route API uniquement).

## Références

- docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md — diagnostic complet (S18).
- docs/INCIDENT_2026-10-02.md — mention initiale « audit_logs toujours
  à 0 » (ligne 137, reformulée S19).
- docs/DB_STATE_2026-10-02.md — snapshot T1, audit_logs = 0.
- docs/adr/007-withauth-async-await.md — format de référence.
- prisma/schema.prisma — modèle AuditLog (lignes 295-313).
- src/lib/services/procedures.service.ts — 2 appels d'audit (lignes 162,
  178).
- src/app/api/tauri-auth/token/route.ts — 1 appel d'audit (ligne 45).
- src/app/api/admin/reset/route.ts — truncate audit_logs (ligne 15).
