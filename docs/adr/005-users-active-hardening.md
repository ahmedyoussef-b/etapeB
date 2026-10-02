# ADR 005 — Durcissement multi-branches par `users.active`

- **Date** : 2026-10-02
- **Statut** : Accepté
- **Session** : 17
- **Contexte** : Fermeture du risque résiduel d'ADR 004 (utilisateur désactivé authentifiable)

## Contexte

ADR 004 (session 15) a durci `verifyInjectToken` sur trois axes :
signature HMAC, `exp` obligatoire, existence du `sub` en BDD. Elle a
explicitement reporté la vérification du **statut actif** de l'utilisateur,
car le champ `active` n'existait pas dans le schéma Prisma.

Cette session 17 ferme ce risque résiduel. L'analyse préalable a révélé
un **angle mort plus large que prévu** :

- La branche **Bearer** (`verifyInjectToken`) : couvre uniquement les
  endpoints `web-files/*` et les appels `Authorization: Bearer ...`.
- La branche **NextAuth** (cookie de session) : couvre la **majorité** des
  endpoints API (`withAuth`, `requirePermission`, `getAuthenticatedUser`
  directs — environ 35 fichiers). Son callback `jwt` ne consultait **pas**
  la BDD à chaque requête, et le callback `authorize` **ne vérifiait pas**
  `active` au login.

Conséquence du risque tel qu'estimé avant session 17 :

- Un utilisateur désactivé avec un cookie valide pouvait rester
  authentifié **jusqu'à 24 h** (`session.maxAge = 24 * 60 * 60`), voire
  se **reconnecter** et obtenir un nouveau JWT de 24 h.
- Le risque résiduel documenté par ADR 004 (« 15 min max ») était donc
  **sous-évalué**.

## Décision

Ajout du champ `users.active` (migration additive, `BOOLEAN NOT NULL
DEFAULT true`) et durcissement des **trois points d'entrée**
d'authentification :

1. **Callback `authorize`** (`src/lib/auth/options.ts`) — rejet du login
   si `user.active === false`. Empêche la reconnexion d'un utilisateur
   désactivé.
2. **`getAuthenticatedUser` — branche NextAuth** (`src/lib/api/auth-guard.ts`)
   — vérification BDD `active` à chaque appel. Rejette les sessions
   cookie d'utilisateurs désactivés.
3. **`getAuthenticatedUser` — branche Bearer** (`src/lib/api/auth-guard.ts`)
   et **`verifyInjectToken`** (`src/lib/auth/inject-token.ts`) — ajout du
   filtre `active` sur la requête `findUnique` existante. Rejette les
   tokens d'injection d'utilisateurs désactivés.

### Modifications retenues

- **Migration Prisma** `20261002130000_add_users_active` :
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;`
- **Schéma Prisma** : `active Boolean @default(true)` dans `model User`.
- **`src/lib/auth/options.ts`** : ajout de `if (!user.active) return null;`
  dans `authorize`, après la vérification du mot de passe.
- **`src/lib/api/auth-guard.ts`** :
  - Branche NextAuth : `findUnique` sur `users.active` + `try/catch`
    fail-safe (rejet en cas d'erreur BDD).
  - Branche Bearer : `active` ajouté au `select` + condition
    `user && user.active`.
- **`src/lib/auth/inject-token.ts`** : `active` ajouté au `select` +
  condition `!user || !user.active`.
- **Tests** : T1 adapté (`active: true`), T6 ajouté (utilisateur inactif
  → rejet). 6/6 tests Vitest passent.

### Modifications rejetées

- **Modification du callback `jwt`** (`src/lib/auth/options.ts`) : une
  première proposition consistait à vérifier `active` en BDD dans le
  callback `jwt` et à retourner un token « vidé » (`id: undefined`) en
  cas d'inactivité. **Rejetée** pour trois raisons :
  1. NextAuth ne garantit **pas** qu'un token sans `id` entraîne une
     déconnexion ; le comportement côté client est indéterminé.
  2. Le remplacement de la condition `token.role && PRISMA_ROLE_TO_APP_ROLE[...]`
     par `token.id` cassait la normalisation legacy des rôles.
  3. La fail-safe (rejet en cas d'erreur BDD) est **agressive** : une
     panne BDD transitoire déconnecterait tous les utilisateurs.
- **Réduction de `session.maxAge`** : rejetée (UX dégradée pour tous les
  utilisateurs, ne résout pas le cas d'un utilisateur désactivé pendant
  la fenêtre).
- **Externalisation (cache/DB des sessions révoquées)** : rejetée
  (hors périmètre session 17, dépendance infrastructure non justifiée
  tant que `users.active` reste la source de vérité).

## Conséquences

### Positives

- **Fenêtre résiduelle neutralisée sur tous les endpoints protégés** :
  un utilisateur désactivé est rejeté dès le prochain appel API, quelle
  que soit la branche (NextAuth ou Bearer).
- **Reconnexion impossible** pour un utilisateur désactivé
  (`authorize` le refuse).
- **Cohérence multi-branches** : les trois points d'entrée appliquent
  la même règle `active === true`.
- **Défense en profondeur** : `authorize` + `getAuthenticatedUser` +
  `verifyInjectToken` — redondance assumée comme filet de sécurité.

### Négatives

- **1 requête BDD supplémentaire par appel `getAuthenticatedUser`**
  (branche NextAuth). Coût à mesurer en production (SELECT indexé sur
  `id`, négligeable à faible trafic, à surveiller à fort trafic).
- **Fail-safe BDD** : une panne de la base déconnecte tous les
  utilisateurs (choix assumé — préféré à un fail-open qui laisserait
  passer des sessions désactivées).
- **Dette de tests** : aucun test unitaire pour `auth-guard.ts` ni
  `options.ts`. Reporté en session 18+. La validation de ces
  modifications repose sur les tests Vitest de `inject-token.test.ts`
  (T1–T6) et sur des tests manuels.

### Risques résiduels

- **Session cookie** : reste valide côté client jusqu'à 24 h, mais
  **aucun endpoint protégé ne l'accepte** (rejet via
  `getAuthenticatedUser`). Risque effectif : nul sur les endpoints
  couverts.
- **Fuite de `NEXTAUTH_SECRET`** : un attaquant peut forger un token
  pour un utilisateur **actif**. La vérification `active` ne protège
  pas contre ce scénario. Mitigation inchangée : rotation du secret,
  `exp` court (15 min sur les tokens d'injection).
- **Performance** : à surveiller. Si le coût de la requête BDD par
  appel devient problématique, envisager un cache court (TTL 30–60 s)
  — hors périmètre session 17.

## Références

- ADR 002 — Web-as-buffer architecture
- ADR 003 — RAG Web Phase 1
- ADR 004 — Durcissement de `verifyInjectToken`
- `docs/INCIDENT_2026-10-01.md`
- `docs/INCIDENT_2026-10-02.md` (à créer — incidents de session 17)
- `docs/SESSION_STATE_2026-10-01.md`
- `src/lib/auth/options.ts`, `src/lib/api/auth-guard.ts`,
  `src/lib/auth/inject-token.ts`
- `prisma/migrations/20261002130000_add_users_active/migration.sql`
