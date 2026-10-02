# Note technique — Diagnostic `audit_logs`

## 1. Contexte

La table `audit_logs` reste vide depuis le début du projet. La note
`INCIDENT_2026-10-02.md` (ligne 137) indique : « toujours à 0 — le
mécanisme d'audit ne fonctionne pas ». Cette note corrige ce diagnostic.

## 2. Constat

Le mécanisme d'audit n'est PAS cassé. Il est INCOMPLET.

### 2.1 Schéma AuditLog

Modèle Prisma complet, indexes présents, relation vers User configurée.

### 2.2 Couverture actuelle (3 actions)

| Action | Fichier | Déclencheur |
|---|---|---|
| PROCEDURE_ARCHIVED | procedures.service.ts | Archivage de procédure |
| PROCEDURE_DELETED | procedures.service.ts | Suppression de procédure |
| TAURI_TOKEN_FAILED | tauri-auth/token/route.ts | 5 échecs d'auth Tauri |

### 2.3 Pourquoi la table reste vide

1. Peu d'archivages/suppressions de procédures (1 procédure en base).
2. Aucun échec Tauri enregistré.
3. POST /api/admin/reset truncate audit_logs.
4. Aucun audit général (pas de middleware Prisma, pas d'audit sur
   connexions/mutations/actions admin).

## 3. Diagnostic

Le terme « ne fonctionne pas » est impropre. La couverture d'audit
couvre 3 actions spécifiques. Elle est insuffisante pour répondre aux
besoins d'audit d'une application de production.

## 4. Décision

**Report à session 19+ avec mandat humain.**

Justification :
- Décision d'architecture (périmètre d'audit à définir).
- Impact code significatif (middleware Prisma ou service transversal).
- Impact BDD potentiel (volume de logs).
- Nécessite validation explicite de l'humain.

## 5. Recommandations pour session 19+

Questions à trancher par l'humain :
- Quelles actions doivent être auditées ?
  - Connexions / déconnexions ?
  - Création/modification/suppression de toutes les entités ?
  - Actions admin (reset, purge) ?
  - Échecs d'authentification ?
- Faut-il un audit systématique (middleware Prisma) ou ciblé (service) ?
- Faut-il un TTL (rétention) sur audit_logs ?
- Faut-il exposer audit_logs via une route admin ?

## 6. Références

- INCIDENT_2026-10-02.md — mention initiale « audit_logs toujours à 0 »
- DB_STATE_2026-10-01.md §6.2 — audit_logs vide
- prisma/schema.prisma — modèle AuditLog
- src/lib/services/procedures.service.ts — 2 appels
- src/app/api/tauri-auth/token/route.ts — 1 appel
- src/app/api/admin/reset/route.ts — truncate audit_logs
- Session 18 — investigation priorité #5, diagnostic complet.

## 7. Suivi

- [ ] Session 19+ : validation du périmètre d'audit par l'humain.
- [ ] Session 19+ : implémentation (middleware ou service).
- [ ] Session 19+ : mise à jour de INCIDENT_2026-10-02.md (ligne 137)
      pour refléter le diagnostic corrigé.
