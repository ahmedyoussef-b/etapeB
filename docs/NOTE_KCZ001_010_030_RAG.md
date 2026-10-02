# Note technique — KCZ001/010/030 et rappel RAG

## 1. Contexte

Les codes KCZ001, KCZ010, KCZ030 sont des entrées du répertoire
industriel (fonctions système d'automates). Ils échouent au rappel
dans le top-20 du RAG depuis la session 13 (5 sessions).

## 2. Constat

### 2.1 Définition des entrées

| Code | Path | Label |
|---|---|---|
| KCZ001 | SYSTEM/KCZ001 | AA01-1 SYSTEM FUNCTION |
| KCZ010 | SYSTEM/KCZ010 | AA10-1 SYSTEM FUNCTION |
| KCZ030 | SYSTEM/KCZ030 | NA001 SYSTEM FUNCTION |

Source : docs/data-repertoire.json:472-474

### 2.2 Symptôme

Ces 3 codes n'apparaissent jamais dans le top-20 des résultats RAG
pour des requêtes qui devraient les mentionner.

### 2.3 Causes identifiées

1. Chunks courts (~65 caractères) — embedding peu discriminant.
2. Labels génériques (`AA01-1 SYSTEM FUNCTION`).
3. Pas de `description_fr` / `description_en`.
4. Contexte limité (seul parent : `SYSTEM`).
5. Moteur RAG basique : vector similarity uniquement, pas de hybrid
   search, pas de reranking.

## 3. Historique

| Session | Constat | Action |
|---|---|---|
| 13 | Absents du top-20 | Enrichissement chunks |
| 14 | Toujours absents | Ajout Type/Code/Description/Contexte |
| 16 | Toujours insuffisant | Pistes b/c/d |

## 4. Options de correction

| Piste | Description | Complexité | Impact |
|---|---|---|---|
| (a) Enrichir data-repertoire.json | Ajouter description_fr métier | Faible | Moyen |
| (b) Query expansion | Synonymes métier dans cleanQuery | Moyenne | Élevé |
| (c) Reranking | Cross-encoder | Élevée | Élevé |
| (d) Hybrid search | Vector + full-text | Élevée | Élevé |

## 5. Décision

**REPORT à session 19+ avec mandat humain.**

Justification :
- Piste (a) nécessite validation métier (descriptions réelles).
- Pistes (b), (c), (d) sont des chantiers RAG structurants.
- Problème connu, documenté, non urgent.

## 6. Recommandations pour session 19+

Questions à trancher par l'humain :
- Faut-il enrichir les descriptions métier de KCZ001/010/030 ?
  - Si oui : qui fournit les descriptions ? (expert métier ?)
  - Si oui : revectoriser le répertoire après enrichissement.
- Faut-il investir dans le RAG (piste b, c ou d) ?
  - Si oui : quelle priorité par rapport aux autres chantiers ?
- Y a-t-il d'autres codes du répertoire qui échouent au rappel ?

## 7. Références

- docs/data-repertoire.json:472-474 — définitions KCZ001/010/030
- docs/SESSION_STATE_2026-10-01.md — historique des reports
- docs/RAG_MIGRATION_PLAN.md — contexte RAG
- src/app/api/ai/rag/route.ts — moteur RAG actuel
- src/lib/ai/query-cleaning.ts — cleanQuery (44 préfixes)
- Session 18 — investigation priorité #7

## 8. Suivi

- [ ] Session 19+ : décision sur l'enrichissement métier.
- [ ] Session 19+ : décision sur l'évolution RAG (query expansion,
      reranking, ou hybrid search).