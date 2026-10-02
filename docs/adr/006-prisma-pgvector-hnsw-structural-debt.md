# ADR 006 — Dette structurelle Prisma + pgvector + HNSW

- **Date** : 2026-10-02
- **Statut** : Accepté
- **Session** : 18
- **Concerne** : Base de données, Prisma, pgvector, indexation vectorielle, migrations

## Contexte

Depuis la session 10, l'index HNSW `document_chunks_embedding_hnsw_idx`
(`m=16`, `ef_construction=64`, opérateur `vector_cosine_ops`) accélère la
recherche vectorielle dans l'API `/api/ai/rag`. Il a été créé par une
migration manuelle (`20261001070000_add_document_chunks_hnsw_index`) car le
DSL Prisma ne permet pas de déclarer des index HNSW.

En session 17, une migration Prisma erronée générant `DROP INDEX
"document_chunks_embedding_hnsw_idx"` a été détectée en revue manuelle.
Sans revue, elle aurait supprimé l'index et dégradé les performances RAG en
scan séquentiel silencieux.

## Problème

Prisma ignore l'index HNSW dans sa représentation interne du schéma.
À chaque `prisma migrate dev`, il compare :

- **Schéma attendu (Prisma)** : modèle `DocumentChunk` avec
  `embedding Unsupported("vector(384)")`, sans mention d'index HNSW.
- **Schéma observé (base)** : table `document_chunks` avec index HNSW
  présent.

Résultat : Prisma génère une migration de **régression** (`DROP INDEX`).
Ce mécanisme est silencieux : `prisma migrate status` ne signale aucune
anomalie, et c'est seulement l'inspection manuelle du SQL qui permet de
détecter le problème.

## Dette structurelle

| # | Dette | Description |
|---|---|---|
| D1 | Index HNSW hors du DSL Prisma | `DROP INDEX` automatique à chaque `prisma migrate dev` |
| D2 | Aucune stratégie de migration formalisée pour pgvector | Récidive possible en session 19+ |
| D3 | `embedding` déclaré via `Unsupported("vector(384)")` | Pas d'introspection Prisma du type ; risque de drift silencieux |
| D4 | Paramètres HNSW (`m`, `ef_construction`) uniquement en SQL | Aucune traçabilité dans le schéma Prisma |

## Échelle de gravité

| # | Dette | Gravité | Justification |
|---|---|---|---|
| D1 | DROP INDEX HNSW automatique | **BLOQUANT** | Perte silencieuse de performance RAG ; dérive en scan séquentiel |
| D2 | Absence de stratégie migration pgvector | **ÉLEVÉ** | Récidive structurelle sans garde-fou automatisé |
| D3 | `Unsupported("vector(384)")` sans détection de drift | **MOYEN** | Détection tardive possible ; risque de modification silencieuse du type |
| D4 | Paramètres HNSW hors schéma Prisma | **FAIBLE** | Risque de modification silencieuse des paramètres d'indexation |

## Décision

1. **Ne jamais exécuter `prisma migrate dev` sans inspection manuelle du SQL**
   quand pgvector/HNSW est concerné. La migration doit être relue avant
   toute application.

2. **Utiliser systématiquement `prisma migrate dev --create-only`** pour
   toute migration. Inspecter et corriger le SQL généré avant application.
   Si l'index HNSW est concerné, privilégier l'écriture manuelle de la
   migration.

3. **Consigner toute modification de l'index HNSW dans un journal dédié**
   (`docs/HNSW_CHANGELOG.md`, à créer lors de la première modification
   effective) et référencer ce journal dans cet ADR. Toute modification des
   paramètres `m` ou `ef_construction` doit être tracée avec sa
   justification.

4. **Ajouter une vérification automatisée** (script ou test d'intégration)
   comparant l'état de `pg_indexes` pour `document_chunks` à l'état attendu
   après chaque déploiement. Voir section « Pistes de résolution à moyen
   terme ».

5. **Maintenir la documentation des paramètres HNSW dans l'ADR** plutôt
   que dans le code applicatif, jusqu'à ce que Prisma supporte nativement
   `@@vector` avec opérateur et paramètres dans le DSL.

6. **Vérification obligatoire du projet Neon cible avant toute migration
   manuelle HNSW.** Croiser le hostname
   (`ep-wild-truth-axxruzqa-pooler.c-4.us-east-2.aws.neon.tech`) avec la
   capture dashboard Neon fournie par l'humain avant toute exécution SQL
   modifiant l'index HNSW. Cette règle fait suite à l'incident S17 où un
   `ALTER TABLE` a été exécuté sur le mauvais projet (`riadh5college` au
   lieu de `etapeB`).

7. **Interdire l'usage de `npm run db:migrate` en production ou sur tout
   environnement où pgvector/HNSW est concerné.** Le script `db:migrate`
   actuel (`prisma migrate dev --name init`) doit être considéré comme
   dangereux : il exécute `prisma migrate dev` avec application immédiate,
   sans passage par `--create-only` ni inspection manuelle du SQL. Toute
   migration doit passer par `prisma migrate dev --create-only`, suivi d'une
   inspection manuelle du SQL, puis d'un `prisma migrate deploy`. La refonte
   du script `db:migrate` pour intégrer `--create-only` et un garde-fou
   HNSW est à planifier en priorité (session 18 ou 19).

## Règles de non-régression

- [ ] Toute migration Prisma passant par `dev` doit être relue avant
      application en production.
- [ ] Le script de vérification post-déploiement doit inclure :
      ```sql
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'document_chunks';
      ```
- [ ] Si l'index HNSW est absent ou altéré après déploiement : rollback
      immédiat et alerte superviseur.

## Pistes de résolution à moyen terme

### Script post-deploy

Un script exécuté après chaque déploiement vérifie la présence et
l'intégrité de l'index HNSW :

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks'
  AND indexname = 'document_chunks_embedding_hnsw_idx';
```

Si le résultat est vide ou si `indexdef` ne contient pas
`USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
le déploiement est considéré comme échoué et un rollback est déclenché.

### Test d'intégration

Un test d'intégration automatise la vérification de l'état attendu de
l'index après migration :

- Comparer `pg_indexes` à l'état attendu.
- Vérifier que `embedding` est toujours de type `vector(384)`.
- Vérifier que l'opérateur `vector_cosine_ops` est bien associé à l'index.

### Outil de migration custom

En attendant que Prisma supporte nativement `@@vector` avec opérateur et
paramètres dans le DSL, un outil de migration custom peut être utilisé pour
gérer les changements de schéma pgvector hors de `prisma migrate dev`.
Cet outil :

- Génère les migrations Prisma pour les changements de schéma standards.
- Délègue les migrations pgvector/HNSW à des scripts SQL manuels ou
  semi-automatisés.
- Garantit que les migrations HNSW sont inspectées avant application.

## Contraintes de version

Le projet utilise **Prisma 7.10.0 avec driver adapter** (`@prisma/adapter-pg`
`^7.10.0`, `@prisma/client` `^7.10.0`, `prisma` `^7.10.0`). `PrismaClient`
s'instancie avec un `adapter`, sans connexion directe. Cette configuration
modifie les mécanismes d'introspection et de migration.

Toute procédure décrite dans cet ADR doit être testée sous cette version
spécifique. Une régression de version de Prisma peut invalider les règles
de non-régression définies ici. En particulier :

- Le comportement de `prisma migrate dev --create-only` peut varier entre
  versions majeures.
- L'inspection manuelle du SQL doit couvrir la syntaxe spécifique au
  driver adapter utilisé.

## Références

- `docs/INCIDENT_2026-10-02.md` — Incident S17, migration `DROP INDEX HNSW`
  erronée.
- `docs/adr/003-rag-web-phase-1.md` — Choix HNSW, `m=16`,
  `ef_construction=64`, opérateur `vector_cosine_ops`.
- `prisma/migrations/20261001070000_add_document_chunks_hnsw_index/migration.sql`
  — Migration manuelle créant l'index HNSW.
- `prisma/schema.prisma` — Modèle `DocumentChunk`, champ
  `embedding Unsupported("vector(384)")`.
- `src/app/api/ai/rag/route.ts` — Opérateur `<=>` (cosine similarity)
  sur `embedding`.
