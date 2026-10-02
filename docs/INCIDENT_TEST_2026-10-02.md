# Incident Test — 2026-10-02 (Session 18)

## Résumé

Session 18 a été marquée par deux incidents de manipulation lors de
l'écriture des tests unitaires pour `auth-guard.ts`, et par une découverte
utile :

**Incidents (erreurs de manipulation) :**
1. Crash du worker Vitest provoqué par un mock sur `Map.prototype.get`
   dans le test du fail-closed du rate limit.
2. Permissions fantômes dans les tests `requirePermission` et
   `hasPermission*` : permissions utilisées qui n'existent pas dans
   `RBAC_MATRIX`.

**Découverte (résultat utile) :**
3. Bug réel découvert dans `withAuth` : la fonction ne `await` pas le
   handler, ce qui provoque un unhandled rejection au lieu d'un 401 propre
   quand un handler async rejette.

## Chronologie

| Heure approx. | Événement |
|---|---|
| ~15:20 | Écriture de `auth-guard.spec.ts` v1 (avec test fail-closed via `Map.prototype.get`) |
| ~15:21 | Exécution Vitest → 12 échecs, 14 passés, 483 546 erreurs, worker crash |
| ~15:22 | Diagnostic : mock natif → contamination worker |
| ~15:25 | Décision superviseur : suppression test fail-closed (C2) |
| ~15:30 | Écriture de `auth-guard.spec.ts` v2 (sans fail-closed) → 8 échecs |
| ~15:35 | Diagnostic : permissions fantômes + mocks manquants + bug `withAuth` |
| ~15:38 | Écriture v3 finale → 25/25 passés |

## Faits

### Incident 1 — Mock `Map.prototype.get` → crash worker Vitest

- **Contexte** : écriture du test fail-closed pour `checkRateLimit`
  (fonction non exportée, testée indirectement via `withAuth`).
- **Action** : `vi.spyOn(Map.prototype, 'get').mockImplementation(() => {
  throw new Error('Store error'); })`.
- **Symptôme** : 483 546 unhandled rejections « Store error », worker
  Vitest crash, 12 tests échouent.
- **Cause** : mock d'un prototype natif JavaScript (`Map.prototype`),
  qui contamine l'ensemble du worker Vitest.
- **Impact** : aucun sur le code source ; fichier de test cassé jusqu'à
  correction.

### Incident 2 — Permissions fantômes dans les tests

- **Contexte** : tests `requirePermission` et `hasPermission*` utilisent
  des permissions qui n'existent pas dans `RBAC_MATRIX`
  (`'structure:read'`, `'admin:manage'`, `'structure:*'`,
  `'structure:write'`).
- **Symptôme** : 8 échecs de test, `AssertionError: expected false to be true`.
- **Cause** : tests écrits contre un RBAC imaginaire, pas contre le
  `RBAC_MATRIX` réel de `src/lib/types/rbac.ts`.
- **Impact** : aucun ; corrigé en utilisant les permissions réelles.

### Découverte 3 — Bug réel `withAuth` sans `await`

- **Contexte** : test du handler throw dans `withAuth`.
- **Symptôme** : unhandled rejection « Handler error », test échoue.
- **Cause** : `withAuth` fait `return handler(...)` sans `await`
  (ligne 159 de `auth-guard.ts`). Un handler async qui rejette n'est
  pas capté par le `try/catch`.
- **Impact** : faille de gestion d'erreur — les routes API protégées
  peuvent retourner des erreurs 500 brut au lieu d'un 401 propre.
- **Statut** : découverte utile, documentée par un test « BUG CONNU »
  dans `auth-guard.spec.ts`. Le bug n'est pas corrigé dans cette session ;
  il sera traité en session 19 avec mandat explicite.

## Origine

| Incident / Découverte | Origine |
|---|---|
| 1 (crash worker) | Mock prototype natif `Map.prototype.get` — règle violation |
| 2 (permissions fantômes) | Tests écrits sans vérification préalable de `RBAC_MATRIX` |
| 3 (bug `withAuth`) | Découverte fortuite lors de l'écriture des tests |

## Périmètre

| Élément | Impact |
|---|---|
| Code source `auth-guard.ts` | ✅ Aucune modification |
| Fichier de test `auth-guard.spec.ts` | ✅ Corrigé, 25/25 passés |
| Base de données | ✅ Aucun accès |
| Production | ✅ Aucun impact |

## Qualification

| Fait | Qualification |
|---|---|
| Mock `Map.prototype.get` | Faute de protocole (mock prototype natif interdit) |
| Permissions fantômes | Erreur de conception des tests |
| Bug `withAuth` async | Découverte utile — à documenter en ADR 007 |
| Test worker crash | NON toléré (impact CI) |

## Décision

**Voie retenue :**

1. **Mock `Map.prototype.get`** → test fail-closed supprimé, remplacé
   par un commentaire référençant ADR 006 (comportement fail-closed
   implicite documenté).
2. **Permissions fantômes** → tests corrigés avec les permissions
   réelles de `RBAC_MATRIX`.
3. **Bug `withAuth` async** → test reformulé en « BUG CONNU » avec
   référence à ADR 007. Le bug n'est pas corrigé dans cette session ;
   il sera traité en session 19 avec mandat explicite.

## Références

- `docs/adr/006-prisma-pgvector-hnsw-structural-debt.md` — ADR 006,
  référence dans le commentaire du test fail-closed.
- `docs/adr/003-rag-web-phase-1.md` — Contexte pgvector/HNSW.
- `src/lib/types/rbac.ts` — `RBAC_MATRIX` réel utilisé pour corriger
  les tests.
- `src/lib/api/auth-guard.ts` — Ligne 159 : bug `withAuth` sans `await`.
- ADR 007 — **À créer en session 19** : vulnérabilité `withAuth` async.
  Référence croisée préparatoire : voir §Découverte 3.
