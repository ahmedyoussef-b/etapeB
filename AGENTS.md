# AGENTS.md — Conventions du projet

## Arborescence BDD (structure-bdd)

Fonctionnalité critique : l'affichage de l'arborescence des données en mode **Local** (`.data/`) et **BDD** (reconstruction depuis les tables Prisma).

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/app/api/structure/route.ts` | Route API `/api/structure` — construit l'arborescence selon la source demandée |
| `src/components/structure/database-tree.tsx` | Composant React — rendu de l'arborescence, chargement lazy des enfants |
| `src/lib/database/structure-types.ts` | Types `TreeNode`, `isVisibleEntry`, `detectEntryType` |
| `src/lib/database/local-adapter.ts` | Adaptateur stockage local (`.data/`) — **lecture seule** |
| `src/lib/database/web-adapter.ts` | Adaptateur stockage web (HTTP ou Prisma) |
| `src/app/(dashboard)/structure-bdd/page.tsx` | Page d'affichage avec sélecteur de source |

### Sources supportées

1. **`local`** — lit `.data/` directement via `LocalDatabaseAdapter`. L'arborescence est la référence immuable.
2. **`db`** — reconstruit l'arborescence depuis les tables BDD (`Block`, `Equipment`, `Group`, `GroupEquipment`) + dossiers complémentaires depuis le disque.
3. **`web`** — lit un serveur web externe via `WebDatabaseAdapter`.

### Règles strictes pour `src/app/api/structure/route.ts`

- **`buildExactTree(adapter, path)`** — fonction principale pour les sources `local` et `web`. Parcourt récursivement via `adapter.list()` + `detectEntryType()`. Tri : dossiers avant fichiers, puis ordre alphabétique.
- **`buildDatabaseTree()`** — pour la source `db` :
  - Construit `Centrale/` depuis les tables `Block` + `Equipment` (avec `subsystemCode` pour les sous-systèmes).
  - Construit `Groupes/` depuis `Group` + `GroupEquipment`.
  - **`bank`, `documents`, `registry`, `system`** : lit `.data/` directement via `buildExactTreeFromDisk()` (ne pas créer de dossiers vides).
  - Tri final : ordre alphabétique des nœuds de niveau supérieur.
- **`buildExactTreeFromDisk(absDir, relPath)`** — lit le disque avec `fs.stat` pour distinguer dossiers/fichiers. Filtre : masque `mirror_repertoire.json` / `mirror.json` mais **pas** le dossier `system`.
- **Prise en charge du paramètre `path`** : pour `source=db`, parcourt l'arborescence complète pour retourner uniquement la sous-arborescence demandée. Si le chemin est introuvable, retourne 404.

### Règles strictes pour `src/components/structure/database-tree.tsx`

- **`isTreeFullyLoaded(nodes)`** — retourne `true` si chaque dossier a `children` défini (tableau vide ou non). Un dossier vide est **chargé**. Ne pas exiger `children.length > 0`.
- **Chargement lazy** : `loadChildren(node)` appelle l'API avec le `path` du nœud. `loadAllChildren` récursif avec `MAX_DEPTH = 5` et `CONCURRENCY = 2`.
- **`dedupeTree`** (de `tree-utils.ts`) — élimine les doublons par `path` avant affichage.
- **Mutations** (rename/delete/mkdir/upload) — uniquement pour `source=web` et `webAvailable=true`. La source `local` est en **lecture seule** (.data est une référence immuable).

### Règles strictes pour `src/lib/database/structure-types.ts`

- **`isVisibleEntry(name)`** — masque `mirror_repertoire.json`, `mirror.json`, et le dossier `system` (pour les sources `local`/`web`). Pour `db`, le dossier `system` est affiché via `buildExactTreeFromDisk` avec un filtre local.
- **`detectEntryType(adapter, fullPath)`** — détermine si un chemin est un dossier ou un fichier. Essaye `adapter.list()` en premier, puis `adapter.readJSON()`, puis `adapter.read()`.

### Règles strictes pour `src/lib/database/local-adapter.ts`

- **Lecture seule** pour `.data/` — `assertWritable()` rejette toute mutation (write, mkdir, delete, rename).
- `list(path)` — retourne les noms d'entrées sans filtre.

### Ne pas casser

- L'ordre de tri : **dossiers avant fichiers**, puis **ordre alphabétique** (`localeCompare`).
- Le mapping des chemins `web` : `mapWebPathToAdapter()` / `mapAdapterPathToWeb()`.
- Les icons selon le `metadata.type` : `Factory` (Centrale), `Users` (Groupes), `Layers` (centrale/groupe), `Wrench` (equipment), `Folder`/`File` par défaut.
- Les logs de débogage préfixés `[DatabaseTree]` et `[API /structure]`.