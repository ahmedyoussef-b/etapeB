# Note technique — Warning SSL `pg-connection-string`

## 1. Contexte

Un warning `pg-connection-string` apparaissait à chaque commande Prisma
depuis la session 11, reporté pendant 7 sessions consécutives :

```
(node:2444) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require',
and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0),
these modes will adopt standard libpq semantics, which have weaker security
guarantees.
```

## 2. Analyse

### 2.1 Origine

- `pg-connection-string@2.14.0` (via `pg@8.23.0`, via `@prisma/adapter-pg`).
- Le paramètre `sslmode=require` est défini dans `DATABASE_URL` et
  `DIRECT_URL` (fichiers `.env.local` et `.env.example`).

### 2.2 Risque réel

- **Aujourd'hui** : `sslmode=require` est traité comme alias de
  `verify-full` (sécurité forte).
- **À partir de `pg-connection-string@3.0.0`** : `require` adoptera la
  sémantique libpq (sécurité plus faible).
- **Risque** : dégradation silencieuse de la vérification SSL lors de la
  prochaine mise à jour majeure.

### 2.3 Classification

- Non bloquant fonctionnellement.
- Mais risque de sécurité à moyen terme (rupture silencieuse).

## 3. Décision

**Option B retenue** : clarifier `sslmode` en `verify-full` explicite.

- Élimine le warning immédiatement.
- Rend l'intention de sécurité explicite.
- Garantit un comportement identique lors des futures mises à jour.

## 4. Mise en œuvre

### 4.1 Fichiers modifiés (session 18)

- `.env.local` : `sslmode=require` → `sslmode=verify-full` (2 occurrences :
  `DATABASE_URL` et `DIRECT_URL`).

### 4.2 Vérification

`npx prisma migrate status` exécuté après modification :
- Warning `pg-connection-string` : absent ✅
- `Database schema is up to date!` ✅
- 16 migrations ✅

### 4.3 À propager (session 19+)

- **Vercel Environment Variables** : vérifier que `DATABASE_URL` et
  `DIRECT_URL` utilisent `sslmode=verify-full`.
- **Config Tauri** : vérifier idem.
- **`.env.example`** : mettre à jour pour cohérence (documentation).

## 5. Recommandations

- **Ne jamais utiliser `sslmode=require`** dans les nouvelles configurations.
- **Préférer `sslmode=verify-full`** (intention explicite).
- **Éviter `uselibpqcompat=true&sslmode=require`** (valide la sémantique
  future affaiblie).
- **Surveiller** les futures versions de `pg` et `pg-connection-string`.

## 6. Références

- `node_modules/pg-connection-string/` — dépendance source.
- `docs/SESSION_STATE_2026-10-01.md` — historique des reports (S11→S17).
- Session 18 — investigation et correction.
- https://www.postgresql.org/docs/current/libpq-ssl.html — documentation
  PostgreSQL SSL.

## 7. Suivi

- [ ] Session 19+ : vérifier Vercel Environment Variables.
- [ ] Session 19+ : vérifier config Tauri.
- [ ] Session 19+ : mettre à jour `.env.example`.
