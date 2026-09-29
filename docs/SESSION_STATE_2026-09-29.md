# 📋 PROMPT DE CONTINUITÉ — Session 8

**À copier-coller au début de la prochaine session**

---

## 🎯 Instructions pour l'assistant externe

Bonjour, je reprends le projet **NexaFlow (ETAPE-B-CCP)** en **session 8**.

Voici le récapitulatif complet de notre travail, de la méthode utilisée, et de l'état exact où on s'est arrêté.

**⚠️ Ce document remplace `SESSION_STATE_2026-09-28.md` (session 6) et `SESSION_STATE_2026-09-27.md` (session 5). Voir ces fichiers si besoin du contexte historique.**

---

## 1. CONTEXTE PROJET

Application hybride web + desktop (Tauri 2.x + Next.js 14) de gestion de procédures industrielles, équipements, rondes et documentation technique.

### Architecture finale

**3 BDD isolées** :

| BDD | Emplacement | Mutable ? |
|---|---|---|
| Local (DEV) | `C:\ahmed\ETAPE-B-CCP\app\.data\` | ❌ Read-only |
| Local (Tauri) | `%APPDATA%\NexaFlow\repository\` | ✅ |
| Web | Neon PostgreSQL (cloud) | ✅ |
| Vectorielle (Tauri) | `%APPDATA%\NexaFlow\chroma\` | ✅ |
| Vectorielle (Web) | Neon pgvector (table `document_chunks`) | ✅ |

### Stack technique

- Frontend : Next.js 14, React, TypeScript, Tailwind, Shadcn
- Backend web : Vercel, API Routes
- BDD cloud : Neon PostgreSQL + Prisma 7
- Desktop : Tauri 2.x (Rust)
- Embeddings (Tauri) : fastembed v4 + ONNX
- **Embeddings (Web) : Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`, 384 dims)**
- LLM : Groq (`openai/gpt-oss-120b`)
- Auth : NextAuth v4 (web) + auth Rust locale (Tauri)

### Chemins projet

```
C:\ahmed\ETAPE-B-CCP\app\                  (projet principal)
C:\ahmed\ETAPE-B-CCP\app\src-tauri\        (code Rust Tauri)
C:\ahmed\ETAPE-B-CCP\backup-binaries\      (binaires MSI/NSIS sauvegardés)
```

---

## 2. MÉTHODE DE TRAVAIL

### TROIS ACTEURS

1. **L'UTILISATEUR** exécute les prompts dans son IA interne
2. **L'IA INTERNE** (Kilocode) exécute les commandes et fait les modifs
3. **TOI** (assistant externe) fournis des prompts structurés étape par étape

### FLUX

```
Toi → prompt structuré
Moi → colle dans l'IA interne
IA interne → exécute et rapporte le brut
Moi → te colle le brut
Toi → analyses, valides ou corriges
Toi → fournis l'étape suivante
```

### RÈGLES FONDAMENTALES

1. **UNE SEULE ÉTAPE À LA FOIS** — pas d'avancement sans validation
2. **TOUJOURS faire une inspection préalable** (lecture seule) avant de modifier
3. **TOUJOURS tester après chaque étape**
4. **NE JAMAIS supposer** — toujours vérifier le code réel
5. **RÈGLE ÉTAT WIP** : avant chaque modification, `git status` + `git diff`
6. **RÈGLE BUILD** : avant tout `npx next build`, arrêter `next dev`
7. **Un commit par étape**, message conventionnel
8. **⚠️ RÈGLE D'OR TAURI** : `tauri dev` ≠ MSI. Validation finale par rebuild MSI
9. **⚠️ RÈGLE ZÉRO FETCH** : aucun `fetch('/api/*')` non-guardé en mode Tauri
10. **⚠️ RÈGLE IA INTERNE** : l'IA interne ne peut PAS interagir avec l'UI
11. **⚠️ RÈGLE BUILD DESKTOP** : `node scripts/build-desktop.js` AVANT `npx tauri build`
12. **⚠️ RÈGLE BRUT COMPLET** : l'IA interne doit fournir le brut **VERBATIM** (pas de résumé, pas de `...`)
13. **⚠️ RÈGLE BUDGET** : **0 € absolu** — toute solution doit être 100% gratuite
14. **⚠️ RÈGLE .DATA IMMUABLE** : `.data/` ne doit JAMAIS être écrit par l'app

---

## 3. ÉTAT ACTUEL DU PROJET (fin session 7)

### Commits récents sur `origin/main`

```
ede8691 chore(gitignore): ignore local utility scripts
7db946c feat(rag): add web RAG route with pgvector search and Groq generation
e63a1b5 chore(prisma): add manual migration for document_chunks + pgvector
5b3c8d5 feat(rag): add DocumentChunk model with pgvector embedding column
ef5e312 feat(rag): add Cloudflare Workers AI embeddings API route
373aa71 refactor(rag): remove local auto-vectorizer in favor of web RAG
```

### Réalisations session 7

| # | Élément | État |
|---|---|---|
| 1 | Token Cloudflare Workers AI opérationnel | ✅ |
| 2 | Refactor `auto_vectorizer` supprimé | ✅ |
| 3 | Route `/api/ai/embed` (Cloudflare) | ✅ |
| 4 | Modèle `DocumentChunk` + pgvector | ✅ |
| 5 | Migration SQL prête (`20260929090536_add_document_chunk`) | ✅ |
| 6 | Module `embedTexts` (refactor) | ✅ |
| 7 | Module `cleanQuery` (port Rust → TS) | ✅ |
| 8 | Route `/api/ai/rag` (pipeline complet) | ✅ |
| 9 | `scripts/get-admin-user.ts` ignoré | ✅ |

### Fichiers clés créés en session 7

- `src/app/api/ai/embed/route.ts` (route embed)
- `src/app/api/ai/rag/route.ts` (route RAG)
- `src/lib/ai/cloudflare-embeddings.ts` (module embed)
- `src/lib/ai/query-cleaning.ts` (module clean)
- `prisma/migrations/20260929090536_add_document_chunk/migration.sql` (migration manuelle)
- `prisma/schema.prisma` (modèle `DocumentChunk`)

### Problème connu en fin de session 7

**Neon PostgreSQL inaccessible** (temporaire). Le serveur Next.js démarre, mais Prisma ne peut pas se connecter. **C'est ce qui bloque les tests end-to-end.**

---

## 4. PROCHAINES ÉTAPES — Session 8

### Priorité immédiate

**Dès que Neon est de retour** :

1. **Vérifier Neon** :
   ```powershell
   cd C:\ahmed\ETAPE-B-CCP\app
   npx prisma db pull --print 2>&1 | Select-Object -First 20
   ```

2. **Valider le schéma** :
   ```powershell
   npx prisma validate
   ```

3. **Vérifier drift** :
   ```powershell
   npx prisma migrate status
   ```

4. **Appliquer la migration** :
   ```powershell
   npx prisma migrate dev
   ```

5. **Vérifier la colonne embedding** :
   → Neon Console → SQL Editor :
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'document_chunks';
   ```
   → Vérifier que `embedding` existe avec type `USER-DEFINED` (pgvector).

6. **Démarrer le serveur** :
   ```powershell
   npm run dev
   ```

7. **Récupérer un cookie de session** :
   → Navigateur → http://localhost:3000 → se connecter → DevTools → Application → Cookies → copier `next-auth.session-token`

8. **Tester `/api/ai/embed`** :
   ```powershell
   curl.exe -s -X POST http://localhost:3000/api/ai/embed `
     -H "Content-Type: application/json" `
     -b "next-auth.session-token=<COOKIE>" `
     -d '{\"texts\": [\"test embedding\"]}'
   ```
   **Attendu** : `{ embeddings: [[...384]], model, dimensions: 384 }`

9. **Tester `/api/ai/rag`** :
   ```powershell
   curl.exe -s -X POST http://localhost:3000/api/ai/rag `
     -H "Content-Type: application/json" `
     -b "next-auth.session-token=<COOKIE>" `
     -d '{\"question\": \"Qu''est-ce qu''une turbine ?\"}'
   ```
   **Attendu** : `{ answer, context: [], model, question, cleanedQuery }` (context vide si pas de chunks en DB)

10. **Insérer des chunks de test** (si base vide) :
    → Script SQL ou Prisma Studio
    → Puis re-tester `/api/ai/rag`

### Points de vigilance à valider

| # | Point | Risque | Action si échec |
|---|---|---|---|
| 1 | `LIMIT ${topK}` accepté par Prisma | Erreur SQL possible | Remplacer par `LIMIT ${topK}::int` |
| 2 | `embeddingStr::vector` accepté | Erreur de cast possible | Utiliser `Prisma.raw()` ou `$executeRaw` |
| 3 | `$queryRaw` type inféré | TS strict possible | Ajouter `$queryRaw<Array<...>>` explicite |

### Fichiers en attente

| Fichier | Action |
|---|---|
| `.env.local.example` | À commiter (ajout Redis/Pusher) — séparé |
| `docs/src/` | Investiguer (7 MB, ignoré) |

---

## 5. PHASES SUIVANTES (après Phase 1)

### Phase 2 — Cache sémantique (Upstash Redis)

- -70% appels API via cache
- Nécessite compte Upstash (gratuit)
- À démarrer quand Phase 1 stable

### Phase 3 — Reranking + Validation

- +30% pertinence (port Rust → TS)
- À démarrer quand Phase 2 stable

### Phase 4 — Sync Desktop ↔ Web (optionnel)

- Unification des 2 RAG

### Phase 5+ — Fine-tuning (reporté)

- LoRA sur Cloudflare Workers AI

---

## 6. COMMANDES UTILES

```powershell
# Aller dans le projet
cd C:\ahmed\ETAPE-B-CCP\app

# Vérifications
npx tsc --noEmit 2>&1 | Select-String -NotMatch "docs/src"
cd src-tauri && cargo check && cd ..

# État Git
git status
git log --oneline -10

# Prisma
npx prisma validate
npx prisma migrate status
npx prisma migrate dev
npx prisma studio

# Dev
npm run dev
```

---

## 7. COMMENT REPRENDRE LA PROCHAINE SESSION

**Copiez-collez ce message au début de la nouvelle session :**

> "Bonjour, je reprends le projet NexaFlow (ETAPE-B-CCP) en **session 8**.
>
> Voici le récapitulatif complet : [coller tout ce document]
>
> **État actuel** :
> - Session 7 : RAG Web prêt (5 commits poussés : `373aa71` → `ede8691`)
> - En attente : Neon PostgreSQL (offline en fin de session 7)
> - Working tree : propre
> - Dernier commit : `ede8691`
>
> **Priorité session 8** :
> 1. Vérifier Neon
> 2. Appliquer migration `document_chunks`
> 3. Tester `/api/ai/embed` avec auth
> 4. Tester `/api/ai/rag` avec auth
> 5. Valider points de vigilance (LIMIT, cast vector)
>
> **Méthode** :
> - Une seule étape à la fois
> - Inspection → modification → test → commit
> - Bruts verbatim (pas de résumé)
> - Budget 0 € strict
>
> **Question : par où commencer ?**"

---

## 8. FIN DU PROMPT DE CONTINUITÉ

**Sauvegardez ce document dans `docs/SESSION_STATE_2026-09-29.md` du projet.**

**Puis, à la prochaine session** : copie-colle la section 7 en début de conversation.
