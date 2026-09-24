# Performance — `/api/file-content` (2026-09-24)

## Problème initial

- `/api/file-content?source=web&path=...` prenait **22-54s** sur Vercel.
- `/api/file-content` localhost : **54.21s**.
- Cause identifiée :
  - Jusqu'à **10 requêtes Prisma** par lecture (`exists()` + `loadQrContent()` + `read()` + fallbacks).
  - Lecture du `data Bytes` depuis Neon.
  - Encodage **base64** côté serveur (+33% payload).
  - Aucun cache HTTP.

## Solutions appliquées

### Fix 1 — Réduire les requêtes Prisma

- Suppression des `exists()` avant `read()` : `read()` échoue proprement si absent.
- Regroupement des fallbacks : Q/R → Web adapter → `.data/` → workspace.
- `loadQrContent()` appelé **une seule fois**.
- Résultat : **1-2 requêtes Prisma** au lieu de ~10.

### Fix 3 — Cache HTTP navigateur

- Ajout de `Cache-Control: public, max-age=60, must-revalidate` sur les réponses `/api/file-content`.
- Le navigateur cache le fichier 60s.
- Après expiration : revalidation côté serveur.

## Gains mesurés

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `/api/file-content` localhost (1er appel) | 54.21s | 1.1s | **49x** |
| `/api/file-content` Vercel (1er appel) | 22.77s | 14.21s | **~2x** |
| `/api/file-content` Vercel (2e appel, cache) | 22.77s | 17ms | **~1300x** |
| `data:image/jpeg;base64...` | 21ms | 32ms (cache mémoire) | ✅ |

## Prochaines pistes

1. **Fix 2 — Binaire au lieu de base64** : retourner `Buffer` natif avec `Content-Type` → -33% payload, pas d'encodage CPU.
2. **Optimiser `/api/sync-status`** : 15-35s observés, c'est le nouveau goulot.
3. **Réduire polling `web-status`** : 4-11s observés.
4. **Investiguer cache `/api/structure`** : `unstable_cache` en place, mais non confirmé effectif sur Vercel.

## Fichiers modifiés

- `src/app/api/file-content/route.ts`
- `src/app/api/structure/route.ts`
- `src/components/structure/database-tree.tsx`
