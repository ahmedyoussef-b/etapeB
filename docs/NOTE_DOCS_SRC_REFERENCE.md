# Note technique — Rôle de `docs/src/`

## 1. Contexte

Le dossier `docs/src/` existe à la racine du projet, mais est ignoré
par Git (`.gitignore:38`). Il contient 418 fichiers (~4.3 MB) organisés
en 8 sous-dossiers mimant la structure de l'application principale
(`ai/`, `app/`, `components/`, `hooks/`, `lib/`, `middleware/`,
`schemas/`, `types/`).

Son rôle n'était pas documenté de manière centralisée. Cette note
clarifie sa nature et son usage.

## 2. Nature du dossier

`docs/src/` est une **implémentation de référence / prototype de
recherche** d'une plateforme RAG complète. Il n'est PAS :
- du code de production (le code de production est dans `src/`),
- un dossier mort ou abandonné,
- un projet tiers.

Il contient notamment :
- `docs/src/ai/` : ~100 fichiers (adaptive-tuning, continuous-learning,
  training/colab, agents, RAG, reasoning, vector stores, cache).
- Comparaison : `src/lib/ai/` (production) contient 7 fichiers.

## 3. Documentation liée

Deux documents décrivent son rôle :
- `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md` — rapport comparatif
  `docs/src` vs `src/` production.
- `docs/RAG_MIGRATION_PLAN.md` — plan de migration des innovations de
  `docs/src` vers la production.

## 4. Pourquoi est-il ignoré par Git ?

- Il s'agit de code **expérimental / documentaire**, pas de code de
  production.
- Il sert de **source d'innovation** pour RAG Phase 2.
- Le committer polluerait le dépôt (4.3 MB, ~100 fichiers de code
  avancé).
- Il est maintenu hors Git pour éviter toute confusion avec `src/`.

## 5. Décision (session 18)

**Conserver `docs/src/` tel quel, documenter son rôle.**

Options écartées :
- **Renommer** en `docs/reference/rag-platform/` → modifierait
  `.gitignore` et 2 documents existants. Risque de casse.
- **Committer** → pollution du dépôt.
- **Supprimer** → destruction d'une référence stratégique pour RAG
  Phase 2.

## 6. Recommandations

- **Ne pas modifier `docs/src/`** sans décision formelle (impact sur
  RAG Phase 2).
- **Ne pas committer `docs/src/`** (rester ignoré par Git).
- **Consulter `docs/RAG_MIGRATION_PLAN.md`** avant tout travail sur
  RAG Phase 2.
- **Mettre à jour cette note** si le rôle de `docs/src/` évolue.

## 7. Références

- `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md` — analyse comparative.
- `docs/RAG_MIGRATION_PLAN.md` — plan de migration.
- `.gitignore:38` — `docs/src` ignoré.
- `.gitignore:93` — `docs/app/` ignoré (rôle non documenté).
- Session 18 — investigation priorité #10.

## 8. Suivi

- [ ] Session 19+ : statuer sur `docs/app/` (rôle inconnu).
- [ ] RAG Phase 2 : utiliser `docs/src/` comme référence.
- [ ] Session 19+ : évaluer si un renommage est pertinent.
