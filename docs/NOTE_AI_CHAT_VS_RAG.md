# Note technique — `/api/ai/chat` vs `/api/ai/rag`

## 1. Contexte

Deux routes API coexistent pour l'IA :
- `/api/ai/chat` — chat libre sans RAG
- `/api/ai/rag` — chat avec RAG

Le frontend `chat-ia` utilise `/api/ai/chat`, pas `/api/ai/rag`. Cela explique les hallucinations constatées en S14.

## 2. Constat

### 2.1 Description des deux routes

| Caractéristique | `/api/ai/chat` | `/api/ai/rag` |
|---|---|---|
| Fichier | `src/app/api/ai/chat/route.ts` (102 lignes) | `src/app/api/ai/rag/route.ts` (148 lignes) |
| Entrée | `{ message, context }` | `{ question, topK }` |
| RAG | ❌ Non | ✅ Oui |
| Embedding | ❌ | ✅ Cloudflare |
| Recherche | ❌ | ✅ pgvector |
| Contexte | Aucun | Chunks similaires |
| Réponse | `{ reply, source, model }` | `{ answer, context[], model, question, cleanedQuery }` |
| Auth | `procedures:view` | `procedures:view` |
| Fallback | Mock `generateAssistantAdvice` | Aucun fallback |
| Appelé par | `useAiChat` (chat-ia) | Jamais appelé |

### 2.2 Usages réels

- `src/app/(dashboard)/chat-ia/page.tsx` utilise le hook `useAiChat` (`src/lib/ai/use-ai-chat.ts`, 254 lignes).
- `useAiChat` appelle **`/api/ai/chat`** en mode web (ligne 151).
- `/api/ai/rag` n'est **jamais appelé** par le frontend web.

### 2.3 Asymétrie des fallbacks

- `/api/ai/chat` : fallback Groq → mock `generateAssistantAdvice`.
- `/api/ai/rag` : aucun fallback. Si Groq/Cloudflare/BDD échouent, erreur 500.
- `useAiChat` : fallback web `/api/ai/chat` → Tauri local `askRagStream`.

## 3. Diagnostic

Les deux routes sont **distinctes et indépendantes**.

`chat-ia` utilise `/api/ai/chat` → **réponse sans base de connaissances**. Cela explique le constat S14 : réponse hallucinée (`CFI = Control Function Interface` au lieu de `FILTRATION EAU DE REFRIGERATION`).

`/api/ai/rag` existe mais **n'est jamais utilisé** par le frontend. Route "morte" pour le web.

## 4. Options

| Option | Description | Complexité | Impact |
|---|---|---|---|
| **(a) Documenter** | Clarifier les rôles dans les docs | Faible | Faible |
| **(b) Unifier** | Faire appeler `/api/ai/rag` depuis `chat-ia` | Moyenne | Élevé |
| **(c) Supprimer `/api/ai/chat`** | Garder uniquement `/api/ai/rag` | Moyenne | Élevé |
| **(d) Fusionner** | Créer une route unifiée chat+RAG | Élevée | Élevé |
| **(e) Reporter** | Laisser cohabiter, décision S19+ | N/A | N/A |

## 5. Décision

**REPORT à session 19+ avec mandat humain.**

Justification :
- Les deux routes ont des finalités différentes : `chat` = conversation libre, `rag` = recherche documentée.
- Mais `chat-ia` utilise `chat`, pas `rag` → problème d'architecture avéré.
- Corriger nécessite soit de modifier `useAiChat` (impact UX), soit de supprimer `/api/ai/chat` (impact code).
- Décision architecturale qui dépasse le cadre d'une investigation de session.

## 6. Recommandations pour session 19+

Questions à trancher par l'humain :
- Faut-il fusionner les deux routes en une seule route `/api/ai/chat` avec RAG optionnel ?
  - Si oui : quelle est la condition d'activation du RAG ? (paramètre `rag: true` ?)
- Faut-il supprimer `/api/ai/chat` et faire migrer `chat-ia` vers `/api/ai/rag` ?
  - Si oui : prévoir une période de transition / fallback.
- Faut-il conserver les deux routes avec des finalités distinctes ?
  - Si oui : documenter clairement les cas d'usage de chaque route.
- `/api/ai/rag` doit-il être utilisé par d'autres interfaces que `chat-ia` ?
  - Si oui : planifier les appels.
- Faut-il ajouter un fallback sur `/api/ai/rag` (actuellement absent) ?

## 7. Références

- `src/app/api/ai/chat/route.ts` — 102 lignes
- `src/app/api/ai/rag/route.ts` — 148 lignes
- `src/lib/ai/use-ai-chat.ts` — 254 lignes
- `src/app/(dashboard)/chat-ia/page.tsx` — interface web
- `src/lib/ai/query-cleaning.ts` — cleanQuery (44 préfixes)
- `docs/SESSION_STATE_2026-10-01.md` — historique S14 hallucination
- Session 18 — investigation priorité #8

## 8. Suivi

- [ ] Session 19+ : décision sur la fusion/suppression/unification des routes.
- [ ] Session 19+ : décision sur l'ajout de fallback à `/api/ai/rag`.
- [ ] Session 19+ : décision sur l'utilisation de `/api/ai/rag` par d'autres interfaces.