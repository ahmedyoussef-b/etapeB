# Note technique — Diagnostic `audit_logs`

- **Statut** : Implémenté (S20.2)
- **Date** : S18 (diagnostic) · S20 (décisions Axe 1→4) · S20.2 (implémentation)
- **ADR de référence** : `docs/adr/008-audit-logs-extension.md` (Accepté, implémenté S20.2)

## 1. Contexte

La table `audit_logs` restait vide depuis le début du projet avant S20.2. La note
`INCIDENT_2026-10-02.md` (ligne 137) indiquait : « toujours à 0 — le
mécanisme d'audit ne fonctionne pas ». Cette note corrige ce diagnostic.

## 2. Constat (S18)

Le mécanisme d'audit n'était PAS cassé. Il était INCOMPLET.

### 2.1 Schéma AuditLog

Modèle Prisma complet, indexes présents, relation vers User configurée.

### 2.2 Couverture avant S20.2 (3 actions)

| Action | Fichier | Déclencheur |
|---|---|---|
| PROCEDURE_ARCHIVED | procedures.service.ts | Archivage de procédure |
| PROCEDURE_DELETED | procedures.service.ts | Suppression de procédure |
| TAURI_TOKEN_FAILED | tauri-auth/token/route.ts | 5 échecs d'auth Tauri |

### 2.3 Pourquoi la table restait vide (avant S20.2)

1. Peu d'archivages/suppressions de procédures (1 procédure en base).
2. Aucun échec Tauri enregistré.
3. POST /api/admin/reset truncate audit_logs.
4. Aucun audit général (pas de middleware Prisma, pas d'audit sur
   connexions/mutations/actions admin).

## 3. Diagnostic (S18)

Le terme « ne fonctionne pas » était impropre. La couverture d'audit
couvrait 3 actions spécifiques. Elle était insuffisante pour répondre aux
besoins d'audit d'une application de production.

## 4. Décision (S18 → S20 → S20.2)

**Report en S18 → décisions tranchées en S20 → implémenté en S20.2.**

Justification du report initial (S18) :
- Décision d'architecture (périmètre d'audit à définir).
- Impact code significatif (middleware Prisma ou service transversal).
- Impact BDD potentiel (volume de logs).
- Nécessite validation explicite de l'humain.

**Décisions tranchées en S20 (ADR 008) :**

| Axe | Décision | Libellé |
|---|---|---|
| Axe 1 — Périmètre | **P1** | Sécurité uniquement (connexions + mutations admin) |
| Axe 2 — Approche | **I2** | Service ciblé (`auditService.log()`) |
| Axe 3 — Rétention | **J4** | 3 ans (cron S21+) |
| Axe 4 — Exposition | **K2** | Route API uniquement · `admin` uniquement |
| Q5 — Performance | ⏸️ | Laissée ouverte, à traiter en S21+ |

## 5. Implémentation S20.2

**Chantier D — 9 commits (7955b04 → ffae47e).**

### 5.1 Service d'audit

- Fichier : `src/lib/services/audit.ts` (D.3 — commit `7d92482`).
- API : `auditService.log(input: AuditLogInput): Promise<void>`.
- Type `AuditAction` (9 constantes : LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT,
  ADMIN_RESET, ADMIN_PURGE, ADMIN_SYNC_PURGE, PROCEDURE_ARCHIVED,
  PROCEDURE_DELETED, TAURI_TOKEN_FAILED).
- Comportement **fail-safe** : toute erreur d'insertion est avalée et
  loggée en `logger.warn`. Une panne d'audit ne casse jamais l'action
  métier appelante.
- Tests : 5 unitaires (`src/lib/services/__tests__/audit.test.ts`).

### 5.2 Permission RBAC

- Fichier : `src/lib/types/rbac.ts` (D.2a — commit `7955b04`).
- Nouvelle permission : `audit-logs:view`.
- Ajoutée au type `Permission` + à `RBAC_MATRIX['admin']` uniquement.
- Tests : 7 unitaires (`src/lib/types/__tests__/rbac.test.ts` — D.2b — commit `8bc0ae9`).

### 5.3 Points d'appel instrumentés (9)

**Auth (D.4a — commit `c0fc895`) :**
- `LOGIN_SUCCESS` — `src/lib/auth/options.ts` (fin `authorize`).
- `LOGIN_FAILED` — `src/lib/auth/options.ts` (cas mauvais password + user inactif).
- `LOGOUT` — `src/lib/auth/options.ts` (callback `signOut`).

**Admin (D.4b — commit `829c191`) :**
- `ADMIN_RESET` — `src/app/api/admin/reset/route.ts` (après transaction).
- `ADMIN_PURGE` — `src/app/api/admin/purge-web/route.ts` (après mutation).
- `ADMIN_SYNC_PURGE` — `src/app/api/admin/sync-purge/route.ts` (après boucle).

**Harmonisation (D.4c — commit `515049b`) :**
- `PROCEDURE_ARCHIVED` — `src/lib/services/procedures.service.ts` (via `auditService.log()`).
- `PROCEDURE_DELETED` — `src/lib/services/procedures.service.ts` (via `auditService.log()`).
- `TAURI_TOKEN_FAILED` — `src/app/api/tauri-auth/token/route.ts` (via `auditService.log()`).

### 5.4 Route d'exposition admin

- Fichier : `src/app/api/admin/audit-logs/route.ts` (D.5 — commit `4420f73`).
- Méthode : `GET`.
- Protection : `withAuth(handler, 'audit-logs:view')`.
- Pagination : `page` / `limit` (défaut 50, max 200).
- Filtres : `action`, `entity`, `entityId`, `userId`, `from`, `to`.
- Ordre : `createdAt: desc`.
- Tests : 5 unitaires (`src/app/api/admin/audit-logs/__tests__/route.test.ts`).

### 5.5 Tests

| Suite | Nombre | Fichier |
|---|---|---|
| Service audit | 5 | `src/lib/services/__tests__/audit.test.ts` |
| RBAC | 7 | `src/lib/types/__tests__/rbac.test.ts` |
| Route audit-logs | 5 | `src/app/api/admin/audit-logs/__tests__/route.test.ts` |
| **Total nouveaux** | **17** | — |
| Suite globale | 71 | (54 existants + 17 nouveaux) |

## 6. Limites connues

- `LOGOUT` est loggé avec `entityId: 'session'` (pas de `userId` disponible
  dans le callback `signOut` NextAuth). Amélioration possible en S21+.
- Les événements d'auth (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`) sont
  loggés en fire-and-forget (sans `await`) — cohérent avec la criticité
  faible de ces événements. Les mutations admin utilisent `await`.
- `ipAddress` / `userAgent` ne sont pas disponibles dans `authorize`
  (callback NextAuth sans `NextRequest`). Ils sont renseignés pour les
  routes API admin.
- Aucune purge automatique (rétention 3 ans reportée S21+).

## 7. Références

- `docs/adr/008-audit-logs-extension.md` — ADR de référence (Accepté, implémenté S20.2).
- `docs/INCIDENT_2026-10-02.md` — mention initiale « audit_logs toujours à 0 » (ligne 137).
- `docs/DB_STATE_2026-10-01.md` §6.2 — audit_logs vide (avant S20.2).
- `prisma/schema.prisma` — modèle AuditLog (lignes 295-313).
- `src/lib/services/audit.ts` — service `auditService.log()`.
- `src/lib/types/rbac.ts` — permission `audit-logs:view`.
- `src/lib/services/procedures.service.ts` — 2 appels d'audit (harmonisés S20.2).
- `src/app/api/tauri-auth/token/route.ts` — 1 appel d'audit (harmonisé S20.2).
- `src/app/api/admin/reset/route.ts` — truncate + `ADMIN_RESET`.
- `src/app/api/admin/purge-web/route.ts` — `ADMIN_PURGE`.
- `src/app/api/admin/sync-purge/route.ts` — `ADMIN_SYNC_PURGE`.
- `src/app/api/admin/audit-logs/route.ts` — route GET paginée.
- Session 18 — investigation priorité #5, diagnostic complet.
- Session 20 — décisions Axe 1→4 (ADR 008).
- Session 20.2 — implémentation du chantier D (9 commits).

## 8. Suivi

- [x] S20 : validation du périmètre d'audit par l'humain (décisions Axe 1→4).
- [x] S20 : implémentation du service ciblé (`auditService.log()`).
- [x] S20.2 : permission RBAC `audit-logs:view`.
- [x] S20.2 : instrumentation des 9 points d'appel.
- [x] S20.2 : route `GET /api/admin/audit-logs` (avec pagination).
- [x] S20.2 : mise à jour `docs/adr/008-audit-logs-extension.md`.
- [ ] S21+ : cron de purge (rétention 3 ans — Axe 3 → J4).
- [ ] S21+ : mesures de performance (Q5).
- [ ] S21+ : améliorer `LOGOUT` (récupérer `userId` via session).