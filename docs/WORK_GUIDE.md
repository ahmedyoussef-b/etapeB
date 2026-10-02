# WORK_GUIDE — Guide de travail du projet NexaFlow / ETAPE-B-CCP

## 1. Objet du guide

### 1.1. À quoi sert ce document
Ce document est la **référence permanente** du projet NexaFlow. Il décrit les rôles, les règles, les procédures et les conventions appliqués pendant les sessions de travail. Il est destiné à tout nouvel intervenant (humain, superviseur, IA interne) qui rejoint le projet sans contexte préalable.

### 1.2. Public cible
- **Humain** : décideur final, exécutant SQL, autorisateur de risque, fournisseur des captures dashboard.
- **Superviseur** : gardien du protocole, valide chaque étape, tranche en cas de conflit.
- **IA interne** : exécutante non-SQL, consultante technique, soumise à surveillance stricte.
- **Nouvel intervenant** : toute personne qui rejoint le projet en cours de route.

### 1.3. Comment l'utiliser
- **Consultation** : lire les sections 1 à 9 avant toute action.
- **Mise à jour** : toute modification de ce guide nécessite une validation humaine.
- **Référence croisée** : ce guide référence les documents `ADR`, `INCIDENT`, `NOTE`, `SESSION_STATE` et `WORK_GUIDE` du projet.

---

## 2. Contexte projet

### 2.1. NexaFlow / ETAPE-B-CCP
NexaFlow est une application hybride **Web + Desktop** destinée à la gestion et à l'exploitation de données énergétiques. Le projet ETAPE-B-CCP couvre la phase de construction, de test et de migration technique de l'application.

### 2.2. Architecture
- **Web** : Next.js (frontend + API routes) déployé sur Vercel.
- **Desktop** : Tauri (wrapper desktop) consommant les mêmes API Web.
- **Buffer** : l'application Web sert de buffer entre le Desktop et la base de données.

### 2.3. Stack technique
- **Backend** : Next.js API Routes, Prisma ORM.
- **Base de données** : PostgreSQL hébergé sur Neon (projet `etapeB`, branche `production`, base `neondb`).
- **Vectorisation** : pgvector 0.8.6, index HNSW (m=16, ef_construction=64).
- **Authentification** : NextAuth + `verifyInjectToken` durci (ADR 004).
- **IA / RAG** : embeddings Cloudflare, LLM Groq, endpoint `/api/ai/rag`.
- **Tests** : vitest (auth-guard, options, inject-token).

### 2.4. Documents de référence
- `docs/adr/*` : décisions architecturales.
- `docs/INCIDENT_*.md` : incidents documentés.
- `docs/NOTE_*.md` : notes techniques.
- `docs/SESSION_STATE_*.md` : état du projet par session.
- `docs/DB_STATE_*.md` : état de la base de données.
- `docs/WORK_GUIDE.md` : ce document.

---

## 3. Triangle de travail

### 3.1. Humain
- Décideur final sur les choix techniques et architecturaux.
- Exécutant **uniquement** les requêtes SQL (avec vérification visuelle du projet Neon).
- Autorisateur de risque pour les opérations sensibles (migrations, DDL, suppression).
- Fournisseur des captures dashboard Neon.

### 3.2. Superviseur
- Décideur technique en cours de session.
- Gardien du protocole : valide chaque étape, exige des preuves, tranche en cas de conflit.
- Ne fournit **ni secret ni credentials**.
- Applique la règle B2 : une tentative pour l'IA interne, puis escalade à l'humain.

### 3.3. IA interne
- Exécutante **non-SQL** : code, tests, écriture de fichiers markdown, commits Git.
- Consultante technique : propose des analyses, des diagnostics, des plans de correction.
- **Surveillance ultra-stricte** : une seule tentative par étape, verbatim intégral obligatoire.
- **N'émet pas de feu vert** : elle propose, le superviseur valide.
- Escalade immédiate à l'humain en cas d'échec (règle B2).

### 3.4. Interactions et limites
- L'IA interne ne touche pas à `src/`, `scripts/`, `prisma/` sans mandat explicite.
- L'IA interne ne lit pas `.env` / `.env.local`.
- L'humain ne délègue pas les requêtes SQL à l'IA interne.
- Le superviseur ne s'exécute pas : il valide, il ne code pas.

---

## 4. Zones du dépôt

### 4.1. Zone ACTIVE
- `src/` : code source de l'application.
- `scripts/` : scripts utilitaires (vectorisation, snapshots, etc.).
- `prisma/` : schéma Prisma, migrations, configuration.

**Règle** : toute modification dans ces zones nécessite un mandat explicite, un commit ciblé et une vérification par test.

### 4.2. Zone RÉFÉRENCE
- `docs/src/` : fichiers de référence markdown consommés par l'application (ex. : `data-repertoire.json`).

**Règle** : modifications encadrées par le superviseur, tracées dans `SESSION_STATE`.

### 4.3. Zone DOCUMENTATION
- `docs/` : tous les documents de projet (ADR, INCIDENT, NOTE, SESSION_STATE, WORK_GUIDE).

**Règle** : modifications libres sous validation du superviseur, commit ciblé.

### 4.4. Règles de modification par zone
| Zone | Qui modifie | Validation requise | Commit |
|---|---|---|---|
| ACTIVE | Humain + IA interne (sous mandat) | Superviseur + tests | Ciblé |
| RÉFÉRENCE | Humain + IA interne | Superviseur | Ciblé |
| DOCUMENTATION | Humain + IA interne | Superviseur | Ciblé |

---

## 5. Règles strictes

### 5.1. Règle B2 — Une seule tentative par étape
- L'IA interne a **une seule tentative** par étape.
- En cas d'échec (erreur, verbatim tronqué, contenu non conforme) → **escalade immédiate à l'humain**.
- L'humain prend le relais pour la commande concernée.
- Le superviseur valide.

### 5.2. Règle B3 — Verbatim intégral obligatoire
- Toute sortie de commande, tout diff, tout contenu de fichier doit être fourni **en verbatim intégral**.
- Aucune troncature, aucun `...`, aucun résumé.
- Si le contenu dépasse la limite de caractères du message, fournir par blocs numérotés, intégralement.

### 5.3. Règle B4 — Une étape par message
- **Une seule étape** par message de l'IA interne.
- **Feu vert explicite** du superviseur requis avant l'étape suivante.
- Aucune anticipation, aucune concaténation d'étapes.

### 5.4. Commit ciblé
- **Jamais `git add -A`**.
- Uniquement les fichiers concernés par l'étape en cours.
- Un fichier = un commit quand c'est possible.
- **Aucun commit sans validation du diff** (humain + superviseur).

### 5.5. UTF-8 strict
- Tous les fichiers markdown du projet sont en **UTF-8 sans BOM**.
- PowerShell 5.1 : toujours spécifier `-Encoding UTF8` en lecture et en écriture.
- Vérification UTF-8 stricte après toute écriture sur un fichier markdown critique.
- Pas de cp1252, pas de Latin-1, pas de double-encodage.

### 5.6. Aucun secret dans le chat
- Aucune lecture de `.env` / `.env.local` par l'IA interne.
- Aucun secret, aucun credential, aucune clé API dans le chat.
- Les secrets sont gérés exclusivement par l'humain.

### 5.7. Validation globale vs validation individuelle
- **Validation globale** : mécanisme exceptionnel où l'humain valide une fois pour toutes les étapes d'une priorité, sans validation individuelle à chaque étape.
- **Points de contrôle non-délégables** même en validation globale :
  - Vérification visuelle du projet Neon avant chaque requête SQL.
  - Validation explicite pour le push final.
  - Arrêt immédiat en cas d'anomalie.
  - Absence de secrets dans le chat.
- **Toute validation globale est tracée** dans le `SESSION_STATE` de la session en cours.

---

## 6. Démarrage de session

### 6.1. Les 6 vérifications préalables
1. **Git** : `git status` + `git log --oneline -5` → working tree clean, HEAD sur le bon commit.
2. **Prisma Migrate** : `npx prisma migrate status` → 16 migrations, up to date.
3. **UTF-8** : vérification de l'encodage du `SESSION_STATE` de la veille (UTF-8 strict, pas de BOM).
4. **Neon** : **confirmation visuelle du projet par l'humain** (projet `etapeB`, branche `production`, base `neondb`).
5. **BDD** : snapshot BDD par l'humain (7 documents / 252 chunks / 0 audit_logs / 0 sync_logs / 16 migrations / 5 users actifs).
6. **Working tree** : `git status` → clean.

### 6.2. Lecture du SESSION_STATE de la veille
- Lire `docs/SESSION_STATE_YYYY-MM-DD.md` (section de la session précédente).
- Identifier les priorités reportées, les incidents en cours, les décisions en attente.

### 6.3. Décision de la première priorité
- Le superviseur propose l'ordre des priorités en fonction du contexte.
- L'humain valide ou réviser l'ordre.
- La première priorité est exécutée sous surveillance stricte.

---

## 7. Procédures BDD / Neon

### 7.1. Vérification visuelle du projet Neon
- **Avant CHAQUE requête SQL** : l'humain fournit une capture d'écran du dashboard Neon.
- Vérifier : projet `etapeB`, branche `production`, base `neondb`, région AWS US East 2 (Ohio).
- En cas de doute → **arrêt immédiat**, escalade à l'humain.
- Rappel incidents S16 (mauvais projet) et S17 (`ALTER TABLE` sur `riadh5college`).

### 7.2. Migrations
- **Obligatoire** : `prisma migrate dev --create-only` pour toute nouvelle migration.
- Pas de `prisma migrate dev` sans mandat.
- Pas de DDL manuel (`ALTER TABLE`, `DROP INDEX`) sans validation du superviseur.

### 7.3. Snapshots BDD
- **Snapshot début** : avant toute opération BDD (SELECT/COUNT/INSERT/UPDATE/DELETE).
- **Snapshot post-commit** : après chaque commit touchant la BDD.
- Format : `documents`, `document_chunks`, `audit_logs`, `sync_logs`, `_prisma_migrations`, `users actifs`.

### 7.4. Interdictions
- Pas d'écriture BDD sans mandat explicite.
- Pas de DROP/ALTER sans validation.
- Pas de suppression de projet Neon sans confirmation visuelle.
- Pas de laisser un modal de suppression Neon ouvert.

---

## 8. Procédures Git

### 8.1. Commits ciblés
- Un fichier = un commit quand c'est possible.
- `git add <fichier>` : jamais `git add -A`.
- Le diff est affiché et validé avant chaque commit.

### 8.2. Messages de commit
- **Translittération ASCII systématique** sous PowerShell 5.1 (risque mojibake).
- Exemples : `etait`, `Regle`, `Ref.`, `initialise`.
- **Alternative** : `git commit -F <fichier>` avec fichier UTF-8 strict.
- Toute exception doit être documentée dans le message de commit lui-même.
- Voir `docs/NOTE_GIT_COMMIT_ENCODING.md` pour le détail.

### 8.3. Pas de `git push` avant la fin de session
- Le push est autorisé **uniquement en fin de session**, après validation explicite de l'humain.
- Aucun `git push` intermédiaire.

### 8.4. Push final
- Validation explicite de l'humain requise.
- Le superviseur vérifie : working tree clean, tous les commits sont validés, aucun fichier temporaire résiduel.

---

## 9. Procédures d'écriture et d'encodage

### 9.1. PowerShell 5.1
- Toujours spécifier `-Encoding UTF8` en lecture et en écriture.
- `Get-Content`, `Set-Content`, `Add-Content`, `Out-File` : vérifier le paramètre `-Encoding`.

### 9.2. Pas de `Add-Content` sans vérification d'encodage
- `Add-Content` sans `-Encoding UTF8` écrit en Windows-1252 par défaut.
- Risque : corruption de fichiers markdown, perte de caractères accentués/typographiques.
- Vérifier l'encodage après toute écriture.

### 9.3. Vérification UTF-8 stricte après écriture
- Utiliser `[System.Text.UTF8Encoding]($false, $true)` pour décoder en mode strict.
- En cas d'erreur → **escalade immédiate à l'humain**.

### 9.4. Pas de BOM dans les fichiers markdown
- UTF-8 **sans BOM**.
- Les 3 premiers octets d'un fichier markdown doivent être `#` (0x23), espace (0x20), puis la première lettre du titre.
- Pas de séquence `239, 187, 191` (BOM UTF-8).

---

## 10. Incidents à ne pas répéter

### Tableau récapitulatif S10 → S19

| Session | Incident | Cause racine | Leçon |
|---|---|---|---|
| S10 | Migrations appliquées sans mandat | Défaut de protocole | Toujours valider les migrations avec l'humain |
| S14 | Secret `OWNER_PASSWORD` en clair | Défaut de vigilance | Jamais de secret dans le chat |
| S15 | Encodage UTF-8 non vérifié | Défaut de vérification | Vérifier UTF-8 après toute écriture |
| S16 | Dashboard Neon sur projet tiers | Défaut de vérification visuelle | Vérifier le nom du projet avant chaque requête SQL |
| S17 | DROP INDEX HNSW erroné, `ALTER TABLE` sur `riadh5college`, fuites `injected env`, script `snapshot-bdd.ts` hors protocole, suppressions involontaires de projets Neon | Multiples défauts de protocole | Respecter les zones, valider chaque action, vérifier le projet Neon |
| S18 | 3 commits non autorisés (ADR 007, note Vite, note chat vs rag), 1 reset involontaire, 13 écarts de verbatim intégral, 1 section de traçabilité écrite en squelette, déclaration inexacte de working tree | Défaut de validation + surveillance insuffisante | Validation stricte, verbatim intégral, surveillance activée |
| S19 | V3 — encodage Windows-1252 du bloc Session 18 (844719a), perte de 14 `✅` (U+2705) | PowerShell 5.1 sans `-Encoding UTF8`, translittération non systématique | UTF-8 strict, translittération ASCII Git, vérification post-écriture |

### Criticité par incident
- **S16, S17** : critiques (impact BDD, risque de perte de données).
- **S14** : sécurité (secret exposé).
- **S18** : processus (commits non autorisés, surveillance insuffisante).
- **S10, S15** : mineurs (pas d'impact BDD, mais défaut de protocole).
- **S19 V3** : documentation (fichier critique corrompu, propagé sur `origin/main`).

---

## 11. Conventions de documentation

### 11.1. ADR
- Format : `docs/adr/NNN-slug.md`.
- Exemple : `docs/adr/006-prisma-pgvector-hnsw-structural-debt.md`.
- Numérotation séquentielle, tirets bas, slug descriptif.

### 11.2. INCIDENT daté
- Format : `docs/INCIDENT_YYYY-MM-DD.md`.
- Exemple : `docs/INCIDENT_2026-10-02.md`.
- Regroupe les incidents d'une même session/day.

### 11.3. INCIDENT codé (V1-V6)
- Format : `docs/INCIDENT_V<n>_SESSION<NN>_<SLUG>.md`.
- Exemple : `docs/INCIDENT_V3_SESSION19_ENCODING.md`.
- Utilisé pour les incidents détectés après coup ou nécessitant un code de référence.

### 11.4. INCIDENT test
- Format : `docs/INCIDENT_TEST_YYYY-MM-DD.md`.
- Exemple : `docs/INCIDENT_TEST_2026-10-02.md`.

### 11.5. NOTE
- Format : `docs/NOTE_SLUG.md`.
- Exemple : `docs/NOTE_PRISMA_DOTENVX_LOGS.md`.
- Note technique courte, ciblée.

### 11.6. SESSION_STATE
- Format : `docs/SESSION_STATE_YYYY-MM-DD.md`.
- Exemple : `docs/SESSION_STATE_2026-10-01.md`.
- État du projet à la fin de chaque session.

### 11.7. WORK_GUIDE
- Format : `docs/WORK_GUIDE.md`.
- Document de référence permanent du projet.
- Non versionné par session.

---

## 12. Comportements

### 12.1. Comportement du superviseur
- **Valide sans feu vert** : il ne s'exécute pas, il valide.
- **Tranche** : en cas de conflit, il décide.
- **Refuse hors protocole** : toute action non prévue par le protocole est refusée.
- **Documente** : ADR, INCIDENT, NOTE, SESSION_STATE.
- **Rappelle les règles** : avant chaque phase à risque.
- **Signale toute inversion de rôle** : si l'IA interne émet un feu vert, le superviseur le signale.
- **Exige l'arrêt immédiat en cas d'anomalie**.
- **Ne fournit jamais de secret ni de credentials**.
- **Applique la règle B2** : une tentative pour l'IA interne, puis escalade à l'humain.

### 12.2. Comportement de l'IA interne
- **Exécutante** : elle exécute les commandes autorisées (non-SQL).
- **Consultante** : elle propose des analyses, des diagnostics, des plans.
- **Pas de feu vert** : elle ne valide pas, elle propose.
- **Escalade immédiate** : en cas d'échec (règle B2).
- **Verbatim intégral** : toute sortie est fournie en verbatim (règle B3).
- **Une étape à la fois** : pas d'anticipation (règle B4).
- **Aucun secret** : ne lit pas `.env` / `.env.local`.
- **Commit ciblé** : jamais `git add -A`.

### 12.3. Gestion des inversions de rôle
- Si l'IA interne émet un feu vert → le superviseur le signale immédiatement.
- Si l'humain exécute une commande hors protocole → le superviseur le signale.
- Si le superviseur s'exécute → inversion de rôle signalée.

---

## 13. Gestion des incidents

### 13.1. Détection
- **Qui détecte** : IA interne (erreur PowerShell, défaut d'encodage, diff inattendu), humain (capture dashboard, résultat SQL), superviseur (anomalie de protocole).
- **Comment** : vérifications préalables, preuves P1→P10, diff Git, tests.

### 13.2. Escalade
- **IA interne → humain** : règle B2 (échec d'une étape).
- **Superviseur → humain** : décision technique majeure, validation globale, push final.
- **Humain → superviseur** : arbitrage, validation de diff, feu vert.

### 13.3. Documentation
- **Incident mineur** : note dans `SESSION_STATE`.
- **Incident majeur** : fichier `docs/INCIDENT_*.md` ou `docs/INCIDENT_V<n>_SESSION<NN>_<SLUG>.md`.
- **Leçon** : section « Incidents à ne pas répéter » du `WORK_GUIDE.md`.

### 13.4. Résolution
- **Plan** : proposé par l'IA interne, validé par le superviseur.
- **Exécution** : IA interne sous surveillance stricte.
- **Validation** : preuves P1→P10, diff Git, validation humaine.
- **Commit** : ciblé, message translittéré si nécessaire.
- **Traçabilité** : chaque incident est référencé dans le `SESSION_STATE` et le `WORK_GUIDE.md`.

---

## 14. Encodage et pièges PowerShell

### 14.1. Leçon V3 — cp1252 vs UTF-8
- **Incident V3** : bloc Session 18 de `SESSION_STATE_2026-10-01.md` encodé en Windows-1252.
- **Cause** : `Get-Content` / `Add-Content` sans `-Encoding UTF8` dans PowerShell 5.1.
- **Conséquence** : 51 octets accentués/typographiques corrompus, 102 CRLF introduits.
- **Résolution** : transcode direct au niveau octets (cp1252 → UTF-8), préfixe bit-à-bit intact.
- **Voir** : `docs/INCIDENT_V3_SESSION19_ENCODING.md` pour le détail complet.

### 14.2. Translittération Git
- **Problème** : PowerShell 5.1 transmet les messages Git en Windows-1252.
- **Solution adoptée** : translittération systématique en ASCII pur.
- **Exemples** : `etait`, `Regle`, `Ref.`, `initialise`.
- **Voir** : `docs/NOTE_GIT_COMMIT_ENCODING.md` pour les alternatives et la recommandation.

### 14.3. Vérifications post-écriture systématiques
1. **UTF-8 strict** : décodage avec `throwOnInvalidBytes=true`.
2. **Pas de BOM** : 3 premiers octets ≠ `239, 187, 191`.
3. **CRLF → LF** : aucun `0x0D` résiduel dans les fichiers markdown.
4. **Lignes attendues** : cohérence avec le contenu sémantique.

### 14.4. Référence détaillée
- **Incident V3** : `docs/INCIDENT_V3_SESSION19_ENCODING.md`.
- **Note translittération Git** : `docs/NOTE_GIT_COMMIT_ENCODING.md`.

---

## 15. Références croisées

### Documents internes
- `docs/INCIDENT_2026-10-01.md` — incidents S10-S14.
- `docs/INCIDENT_2026-10-02.md` — incidents S17-S18.
- `docs/INCIDENT_V3_SESSION19_ENCODING.md` — incident V3 (S19).
- `docs/NOTE_PRISMA_DOTENVX_LOGS.md` — logs dotenvx.
- `docs/NOTE_GIT_COMMIT_ENCODING.md` — translittération Git.
- `docs/SESSION_STATE_2026-10-01.md` — état du projet S18 + S19.
- `docs/DB_STATE_2026-10-01.md` — état BDD.
- `docs/RAG_MIGRATION_PLAN.md` — plan de migration RAG.
- `docs/RAG_AI_CHAT_ANALYSIS_REPORT.md` — analyse chat vs RAG.

### ADR pertinents
- `docs/adr/002-web-as-buffer-architecture.md` — architecture Web buffer.
- `docs/adr/003-rag-web-phase-1.md` — RAG Phase 1.
- `docs/adr/004-verify-inject-token-hardening.md` — durcissement `verifyInjectToken`.
- `docs/adr/005-users-active-hardening.md` — durcissement `users.active`.
- `docs/adr/006-prisma-pgvector-hnsw-structural-debt.md` — dette structurelle Prisma + pgvector + HNSW.
- `docs/adr/007-withauth-async-await.md` — bug `withAuth` async.

### Notes techniques
- `docs/NOTE_NEON_MULTI_PROJETS.md` — vérification multi-projets Neon.
- `docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md` — diagnostic `audit_logs`.
- `docs/NOTE_VITE_CONFIG_WARNING.md` — warning config Vite.
- `docs/NOTE_KCZ001_010_030_RAG.md` — investigation KCZ RAG.
- `docs/NOTE_AI_CHAT_VS_RAG.md` — analyse `/api/ai/chat` vs `/api/ai/rag`.
- `docs/NOTE_SSL_PG_CONNECTION_STRING.md` — SSL `pg-connection-string`.
- `docs/NOTE_DOCS_SRC_REFERENCE.md` — rôle de `docs/src/`.

### Historique des sessions
- `docs/SESSION_STATE_2026-10-01.md` — sections S18 et S19.
- Sessions futures : `docs/SESSION_STATE_YYYY-MM-DD.md`.

---

**Version** : 1.0 (S19)
**Dernière mise à jour** : 2026-10-02
**Auteur** : IA interne (supervisée par le superviseur S19)
**Validation** : humain + superviseur S19