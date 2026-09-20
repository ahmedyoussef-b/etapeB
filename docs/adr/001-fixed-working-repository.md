# ADR 001 — Répertoire de travail fixe pour la BDD locale

- **Date** : 2026-09-16
- **Statut** : Accepté
- **Décideur** : Équipe NexaFlow
- **Contexte** : Refactoring I3 (Phase A — Corrections critiques)

## Contexte

L'application NexaFlow est une application hybride (web + desktop Tauri) de
gestion de procédures industrielles. Elle dispose de deux sources de données :

1. **BDD cloud** (Neon PostgreSQL) : assiette de transfert entre l'admin et
   les utilisateurs.
2. **BDD locale** : fichiers miroirs dans `%APPDATA%\NexaFlow\repository\`.

Jusqu'à la version 0.x, l'application proposait une **sélection manuelle de
dossier** via un composant `RepositorySelector`. L'utilisateur pouvait :

- Choisir un dossier sur son disque (ex: `.data11`).
- Copier `.data` (référence immuable) dedans.
- Le configurer comme répertoire de travail actif via `repository-config.json`.

### Problèmes identifiés

1. **Complexité inutile** : la sélection manuelle n'était jamais utilisée en
   pratique (fonctionnalité expérimentale/legacy).
2. **Bugs récurrents** :
   - Copie partielle de `.data` (ex: seul `bank/` copié).
   - Résolution de chemin incorrecte (`repositories/.data11` au lieu de `.data11`).
   - Configuration corrompue (`activeRepository: '.data11'`).
3. **Dette technique** : 7 duplications de `getActiveRepository()`,
   `repository-config.json` non tracké mais présent, artefacts `.data11`.
4. **Incohérence multi-mode** : en mode web (Vercel), `.data` n'est pas
   accessible (resource Tauri), donc la source "Locale" affichait une
   arborescence vide.

## Décision

**Supprimer la sélection manuelle de dossier et adopter une architecture
automatique avec un répertoire de travail fixe.**

### Architecture cible

- **`.data`** : référence immuable embarquée comme resource Tauri.
- **`%APPDATA%\NexaFlow\repository\`** : copie de travail unique.
- **Au premier démarrage** : Rust copie `.data` → `repository/` si `repository/` est vide.
- **Aucune sélection utilisateur**.
- **Aucun `repository-config.json`**.
- **Aucun artefact `.data11`**.

### Détection du mode

- **Mode web (Vercel)** : source "Locale" masquée (pas d'accès à `.data`).
- **Mode desktop (Tauri)** : source "Locale" disponible + source "Web".

## Conséquences

### Positives

- **Simplification** : 7 duplications de `getActiveRepository()` supprimées.
- **Fiabilité** : copie initiale automatique (plus de bug de copie partielle).
- **Cohérence** : un seul répertoire de travail, pas de config à maintenir.
- **Multi-mode** : le mode web masque automatiquement la source "Locale".
- **Moins de code** : `repository-selector.tsx` (200 lignes) supprimé,
  `source-selector.tsx` (83 lignes) supprimé, `/api/repository` simplifié
  (208 → 73 lignes).

### Négatives

- **Perte de flexibilité** : l'utilisateur ne peut plus choisir un autre
  emplacement (disque réseau, OneDrive, etc.). Si ce besoin émerge, il faudra
  ajouter une variable de configuration (ex: `NEXAFLOW_WORKING_DIR`).
- **Migration** : les utilisateurs existants avec un `repository-config.json`
  verront leur configuration ignorée. Le répertoire de travail sera
  `%APPDATA%\NexaFlow\repository\` par défaut.

### Neutres

- **Taille du binaire Tauri** : +183 KB (`.data` embarqué). Négligeable.

## Alternatives rejetées

### Alternative 1 — Garder la sélection manuelle avec corrections ciblées

**Rejetée** car : la fonctionnalité n'était jamais utilisée, les corrections
n'auraient pas résolu la dette technique (7 duplications, config legacy).

### Alternative 2 — Sélection initiale puis fixe

**Rejetée** car : complexité inutile (config à maintenir, bugs de chemin
possibles), pas de besoin utilisateur identifié.

### Alternative 3 — Utiliser `.data` embarqué directement (sans copie)

**Rejetée** car : `.data` est en lecture seule (read-only) — l'utilisateur
doit pouvoir modifier son répertoire de travail (ajout, suppression, renommage).

## Références

- **Audit BDD locale** : `docs/BDD_LOCAL_STABILITY_REPORT.md` (2026-09-15)
- **Commits I3** :
  - `ef35551` — I3.2 : constante partagée
  - `c763ab6` — I3.3a : Pattern A
  - `ef5ade1` — I3.3b : Pattern B
  - `8f103da` — I3.3c : Pattern C
  - `bbcc912` — I3.4.2 : resource Tauri
  - `9b3af2d` — I3.4.3a : get_resource_path
  - `79f372c` — I3.4.3b : ensure_initial_repository
  - `083afb0` — I3.4.4 : appel dans setup()
  - `6998169` — I3.5b : masquage Locale en mode web
  - `d1b27fe` — I3.6b : simplification /api/repository
  - `5e916ef` — I3.7b : suppression RepositorySelector
  - `e190b67` — I3.8b : suppression repository-config.json
  - `2144507` — I3.9b : nettoyage .data11 + SourceSelector