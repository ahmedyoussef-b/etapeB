# ADR 002 — Architecture Web-as-buffer

- **Date** : 2026-10-01
- **Statut** : Accepté
- **Décideur** : Équipe NexaFlow
- **Contexte** : Session 10 (suite au snapshot BDD 2026-10-01)

## Contexte

L'application NexaFlow est une application hybride (web + desktop Tauri) de
gestion de procédures industrielles. Elle dispose de deux sources de données :

1. **BDD cloud** (Neon PostgreSQL) : assiette de transfert entre l'admin et
   les utilisateurs.
2. **BDD locale** : fichiers miroirs dans `%APPDATA%\NexaFlow\repository\`
   et base vectorielle Chroma.

La BDD Web n'est pas la source de vérité. Elle sert de **tampon de transfert** :
l'admin y publie des documents, les utilisateurs les transfèrent vers leur
BDD locale, puis la BDD Web peut être purgée.

### Problèmes identifiés

1. **Ambiguïté du rôle de la BDD Web** : aucun document ne formalisait
   explicitement son statut de tampon. Le rôle était implicite dans le code
   (`purge-web`, `reset`, `sync-purge`) mais jamais acté.
2. **Incohérence entre mécanismes de purge** : `SystemVersion` était préservé
   par `purge-web` mais truncaté par `reset`, ce qui détruisait l'historique
   des publications. Corrigé en session 10 (commit `a660e24`).
3. **Endpoint RAG Web cassé** : `src/app/api/ai/rag/route.ts` requête la table
   `document_chunks` sur Neon, mais cette table n'existe pas en base. Le
   vectoriel vit dans Chroma local. Conséquence : l'endpoint retourne 500.

## Décision

**La BDD Web Neon est un tampon de transfert, pas la source de vérité.**

La source de vérité est la BDD locale (`.data/` + Chroma). La purge de la
BDD Web est **manuelle et contrôlée par un administrateur**.

### Mécanismes de purge

Trois mécanismes coexistent, chacun avec une portée distincte :

- **`purge-web`** : supprime les `documents` (hors `.placeholder`). Ne touche
  aucune autre table.
- **`sync-purge`** : supprime des documents ciblés par `path`.
- **`reset`** : supprime les données métier (20 tables dans un ordre
  FK-safe), puis re-seed les utilisateurs par défaut et les `.placeholder`.

### Invariants

- **`SystemVersion`** : journal de traçabilité des publications. **Préservé**
  par `reset` (commit `a660e24`) et non touché par `purge-web`. Aucun
  mécanisme ne le recrée après truncate — sa préservation est donc
  indispensable.
- **`users`**, **`sessions`**, **`_prisma_migrations`** : **préservés** par
  `reset`.
- **`document_chunks`** : vit dans Chroma local, **absente** de Neon. Le code
  RAG Web qui la requête est actuellement inopérant.

## Conséquences

### Positives

- **BDD Web légère** : ~7 Mo au 2026-10-01, dont 4,7 Mo dans `documents`.
- **Purge manuelle contrôlée** : aucun mécanisme automatique ne peut vider
  la BDD sans intervention admin.
- **Source de vérité locale** : l'application reste fonctionnelle hors-ligne.
- **Traçabilité préservée** : l'historique des publications (`SystemVersion`)
  survit aux purges.

### Négatives

- **RAG Web cassé** : `document_chunks` absente de Neon, l'endpoint
  `/api/ai/rag` retourne une erreur 500. Le RAG fonctionne en local (Chroma)
  mais pas en mode Web.
- **Aucune purge automatique** : la BDD Web dépend d'une action admin
  manuelle. Risque de croissance non maîtrisée si l'admin oublie.
- **`PRESERVED_TABLES` dans `purge-web` est documentaire** : cette liste
  n'est jamais exécutée. Elle expose une intention qui ne correspond pas au
  code réel, source de confusion.

### Neutres

- **`purge-web` ne touche qu'à `documents`** : une seule table, pas de purge
  multi-tables.
- **Fichiers `.placeholder`** : jamais purgés (2 lignes, négligeable).
- **Modèles sans `@@map`** : `PublishQueue`, `UserSyncState`, `SystemVersion`
  utilisent des tables CamelCase en SQL (`"PublishQueue"`, etc.), ce qui peut
  surprendre en SQL brut.

## Alternatives rejetées

### Alternative 1 — Faire de Neon la source de vérité

**Rejetée** car : le terrain (rondiers) opère sans réseau. L'application doit
rester fonctionnelle hors-ligne. La BDD locale est la seule source fiable.

### Alternative 2 — Purge automatique (cron, seuil de taille)

**Rejetée** car : le contrôle admin est requis pour valider que le transfert
vers le local a bien eu lieu. Une purge automatique risquerait de supprimer
des documents non encore transférés.

### Alternative 3 — Héberger Chroma côté Web

**Rejetée** car : latence, coût d'hébergement, duplication avec le Chroma
local. Le RAG local est suffisant pour l'usage terrain.

### Alternative 4 — Supprimer `document_chunks` du schéma Prisma

**Rejetée** car : le code RAG (`src/app/api/ai/rag/route.ts`) l'utilise en
SQL brut. Le problème est un défaut de migration (table absente de Neon), pas
un défaut de modèle. La décision sur l'avenir du RAG Web est reportée.

## Références

- **Snapshot BDD** : `docs/DB_STATE_2026-10-01.md` (commit `03c66f8`)
- **Commit de correction** : `a660e24` — `fix(reset): preserve systemVersion on reset`
- **Analyse RAG** : `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md` (contexte du RAG Web)
- **Plan de migration RAG** : `docs/RAG_MIGRATION_PLAN.md` (à traiter en session 11+)
