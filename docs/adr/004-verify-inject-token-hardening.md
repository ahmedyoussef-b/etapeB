# ADR 004 — Durcissement de `verifyInjectToken`

- **Date** : 2026-10-02
- **Statut** : Accepté
- **Session** : 15
- **Contexte** : Dette sécurité identifiée en session 14 (incident `test-rag.ts`)

## Contexte

`verifyInjectToken` (`src/lib/auth/inject-token.ts`) est la fonction de vérification
des tokens d'injection signés HMAC-SHA256 (algorithme `HS256`, secret
`NEXTAUTH_SECRET`, expiration 15 minutes). Elle est utilisée par 4 appelants :

- `src/app/api/web-files/download/route.ts:16`
- `src/app/api/web-files/mark-injected/route.ts:17`
- `src/app/api/web-files/route.ts:16`
- `src/lib/api/auth-guard.ts:53`

### Faille identifiée

La vérification actuelle (session 14) couvre :

- ✅ Format JWT (3 segments)
- ✅ Signature HMAC-SHA256
- ✅ Type de `sub` (string)
- ✅ Expiration (`exp`) — mais **optionnelle** (`if (payload.exp && ...)`)

Elle ne couvre **pas** :

- ❌ Existence du `sub` en BDD
- ❌ Statut actif de l'utilisateur
- ❌ Caractère obligatoire de `exp`

### Impact

- Un token forgé (si `NEXTAUTH_SECRET` fuite) peut se faire passer pour
  n'importe quel utilisateur, y compris un utilisateur inexistant.
- Les 3 routes `web-files/*` acceptent un token valide **sans consulter la BDD** :
  un token forgé donne accès à ces endpoints sans utilisateur réel.
- `auth-guard.ts` fait une vérification BDD (`prisma.user.findUnique`), mais
  **pas du statut actif** — un utilisateur désactivé resterait authentifiable.
- Un token forgé **sans `exp`** passe la vérification actuelle.

## Décision

**Option B réduite** — vérification BDD d'existence du `sub` dans
`verifyInjectToken`, plus `exp` obligatoire. La vérification du statut actif
(`active`) est **reportée** à une session future car le champ n'existe pas dans
le schéma Prisma actuel (voir « Conséquences »).

### Modifications retenues

1. **`exp` obligatoire** dans `verifyInjectToken` :
   - remplacer `if (payload.exp && Date.now() / 1000 > payload.exp) return null;`
   - par `if (typeof payload.exp !== 'number' || Date.now() / 1000 > payload.exp) return null;`

2. **Vérification BDD du `sub`** :
   - `prisma.user.findUnique({ where: { id: sub }, select: { id: true } })`
   - retour `null` si l'utilisateur n'existe pas.

3. **`verifyInjectToken` devient `async`** :
   - signature : `export async function verifyInjectToken(token: string): Promise<{ sub: string } | null>`
   - conséquence : les 4 appelants ajoutent `await`.

4. **Uniformisation** : les 3 routes `web-files/*` sont protégées par
   transitivité (via `verifyInjectToken`) sans modification de leur logique
   métier — seul l'ajout du `await` est nécessaire.

### Modifications reportées

- **Vérification `active`** : reportée session 16+. Nécessite une migration
  Prisma (`ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true`)
  et une adaptation du seed. Hors périmètre « durcissement code-only ».
- **Option C (audit/log)** : reportée session 16+. Introduirait une dépendance
  `logger` dans un module crypto pur (`inject-token.ts`), couplage non souhaité.
  Les tentatives échouées restent traçables via les logs existants de
  `auth-guard.ts`.

## Conséquences

### Positives

- Les 4 appelants bénéficient de la vérification d'existence du `sub`.
- Les 3 routes `web-files/*` ne peuvent plus être exploitées avec un token
  forgé pour un utilisateur inexistant.
- Un token forgé sans `exp` est rejeté.
- Uniformisation : une seule porte de vérification (`verifyInjectToken`).

### Négatives

- `verifyInjectToken` devient `async` → 5 fichiers modifiés.
- Une requête BDD supplémentaire par appel (coût négligeable : `SELECT id FROM users WHERE id = ?`).
- `auth-guard.ts` fait une double vérification (une dans `verifyInjectToken`,
  une dans `getAuthenticatedUser`) — redondance assumée comme filet de sécurité.

### Risques résiduels

- **Utilisateur désactivé** : non couvert par cette ADR (champ `active` absent).
  Un token valide reste accepté jusqu'à expiration (15 min max) même si
  l'utilisateur est désactivé. Risque accepté, à traiter en session 16+.
- **Fuite de `NEXTAUTH_SECRET`** : un attaquant peut forger un token pour un
  utilisateur **existant**. La vérification d'existence BDD ne protège pas
  contre ce scénario. Mitigation : rotation du secret, expiration courte (15 min).

## Références

- ADR 002 — Web-as-buffer architecture
- ADR 003 — RAG Web Phase 1
- `docs/INCIDENT_2026-10-01.md`
- Incident session 14 : `app/tmp/test-rag.ts` (forge JWT via `NEXTAUTH_SECRET`, purgé)
