# ADR 007 — Handler async non capté dans `withAuth`

- **Date** : 2026-10-02
- **Statut** : Accepté
- **Session** : 18
- **Concerne** : auth-guard.ts, gestion d'erreur, routes API protégées

## Contexte

Le test `auth-guard.spec.ts` écrit en session 18 a révélé un bug dans
`withAuth` : la fonction ne `await` pas le handler avant de le retourner.
Un handler async qui rejette n'est pas capté par le `try/catch` de
`withAuth`, ce qui provoque un unhandled rejection au lieu d'un 401 propre.

## Problème

Ligne 159 de `src/lib/api/auth-guard.ts` :
```typescript
return handler(req, { user, ...(args[0] || {}) } as TContext);
```

`handler` est un `Promise<NextResponse>`. Sans `await` :
- Si le handler résout → `NextResponse` est retourné immédiatement.
- Si le handler rejette → la promesse rejetée se propage hors de
  `withAuth`, hors du `try/catch`, et devient un unhandled rejection.

Conséquence : toute route API protégée par `withAuth` peut retourner une
erreur 500 brut au client au lieu d'un 401 propre en cas d'erreur
asynchrone dans le handler.

## Analyse technique

- **Fonction concernée** : `withAuth` (ligne 133-167 de `auth-guard.ts`).
- **Ligne buguée** : 159 — `return handler(...)` sans `await`.
- **Note** : le `try/catch` de `withAuth` (lignes 137-166) englobe déjà
  l'appel au handler. Une fois `await` ajouté, tout rejet du handler sera
  capté par ce `catch` existant et transformé en réponse 401. Aucun
  `try/catch` supplémentaire n'est nécessaire.
- **Impact** : toutes les routes API utilisant `withAuth` sont concernées.
- **Détection** : test unitaire `auth-guard.spec.ts` (test « BUG CONNU »).
- **Correction minimale** : ajouter `await` devant `handler(...)`.

## Options de correction

### Option 1 — Ajout minimaliste d'`await`

```typescript
return await handler(req, { user, ...(args[0] || {}) } as TContext);
```

- ✅ Corrige le bug sans modifier la structure.
- ✅ Aucun impact sur les signatures ou les appelants.
- ✅ Testable immédiatement.
- ✅ Le `try/catch` existant capture les rejets une fois `await` ajouté.
- ❌ Ne protège pas contre d'autres erreurs async dans le bloc `try`.

### Option 2 — Ajout d'`await` + gestion d'erreur explicite

```typescript
try {
  return await handler(req, { user, ...(args[0] || {}) } as TContext);
} catch (error) {
  logger.warn('Handler error', { error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}
```

- ✅ Corrige le bug.
- ✅ Ajoute un log explicite en cas d'erreur handler.
- ❌ Redondant avec le `catch` externe existant (ligne 160).

### Option 3 — Correction + refonte `withAuth`

Refonte complète de `withAuth` pour séparer rate-limit, auth, permission
dans des fonctions distinctes, avec gestion d'erreur centralisée.

- ✅ Améliore la lisibilité et la testabilité.
- ✅ Facilite l'ajout de middlewares futurs.
- ❌ Hors scope session 19.
- ❌ Risque de régression élevé.

## Décision

**Option 1 retenue** : ajout minimaliste d'`await` devant `handler(...)`.

Justification :
- Corrige le bug sans rupture de compatibilité.
- Le `try/catch` existant de `withAuth` (ligne 160) capturera les rejets
  async une fois `await` ajouté.
- Single-line change, risque de régression minimal.
- Option 2 est redondante (duplique le `catch` externe).
- Option 3 est hors scope.

## Portée de la correction

- **Fichier concerné** : `src/lib/api/auth-guard.ts` (unique).
- **Ligne concernée** : 159.
- **Type de modification** : single-line change.
- **Impact sur les tests existants** : `auth-guard.spec.ts` — le test
  « BUG CONNU » devra être remplacé par un test validant le comportement
  corrigé (401 au lieu de rejet).
- **Impact sur les routes API** : aucune régression attendue ; les
  erreurs 500 brut deviennent des 401 propres.
- **Effort estimé** : 5 minutes (édition) + 10 minutes (test).

## Règles de non-régression

- [ ] Toute modification de `withAuth` doit être couverte par le test
      `auth-guard.spec.ts` existant.
- [ ] Le test « BUG CONNU » doit être mis à jour pour attendre 401 au
      lieu d'un rejet, après correction.
- [ ] Vérifier que toutes les routes API utilisant `withAuth` passent
      leurs tests d'intégration après correction.
- [ ] Ne pas supprimer le test « BUG CONNU » sans l'avoir remplacé par
      un test documentant le comportement corrigé.

## Références

- `src/lib/api/auth-guard.ts` — Ligne 159 : bug `return handler(...)`
  sans `await`.
- `src/lib/api/auth-guard.spec.ts` — Test « BUG CONNU » documentant le
  comportement actuel.
- `docs/INCIDENT_TEST_2026-10-02.md` — Incident test session 18,
  découverte 3.
