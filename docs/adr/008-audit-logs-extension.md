# ADR 008 — Extension de la couverture d'audit

- **Date** : 2026-10-02
- **Statut** : Accepté (décision de report)
- **Session** : 19
- **Concerne** : audit_logs, couverture d'audit, middleware Prisma, politique de rétention

## Contexte

La table `audit_logs` reste vide depuis le début du projet. Le diagnostic
corrigé (NOTE_AUDIT_LOGS_DIAGNOSTIC.md, S18) établit que le mécanisme
d'audit n'est pas cassé, mais **incomplet** : seules 3 actions spécifiques
sont instrumentées.

Couverture actuelle :
- `PROCEDURE_ARCHIVED` — `src/lib/services/procedures.service.ts`
- `PROCEDURE_DELETED` — `src/lib/services/procedures.service.ts`
- `TAURI_TOKEN_FAILED` — `src/app/api/tauri-auth/token/route.ts`

La dette est documentée dans INCIDENT_2026-10-02.md (ligne 137, reformulée
en S19) et dans DB_STATE_2026-10-02.md (snapshot T1 : audit_logs = 0).

## Problème

La couverture d'audit actuelle (3 actions) est insuffisante pour une
application de production du secteur énergétique.

Actions non couvertes :
- Connexions / déconnexions.
- Création / modification / suppression d'entités métier (blocks,
  equipments, groups, procedures, documents).
- Actions admin (reset, purge, sync).
- Échecs d'authentification généraux (au-delà de Tauri).

Le truncate systématique dans POST /api/admin/reset efface toute trace
d'audit antérieure, réduisant la rétention à zéro après chaque reset.

## Analyse technique

### Modèle AuditLog

Schéma Prisma complet (schema.prisma, lignes 295-313) :
- Champs : id, userId, action, entity, entityId, before, after,
  ipAddress, userAgent, createdAt.
- Relation : user (User) avec onDelete: SetNull.
- 4 indexes : (entity, entityId), (userId, createdAt), (action, createdAt),
  (createdAt).
- Table SQL : audit_logs.

### Appels existants

1. PROCEDURE_ARCHIVED — src/lib/services/procedures.service.ts (ligne ~162)
2. PROCEDURE_DELETED — src/lib/services/procedures.service.ts (ligne ~178)
3. TAURI_TOKEN_FAILED — src/app/api/tauri-auth/token/route.ts (ligne ~45)

### Truncate

POST /api/admin/reset : audit_logs est dans TRUNCATE_ORDER
(src/app/api/admin/reset/route.ts, ligne ~15).

### Limitations

- Pas de middleware Prisma pour audit général.
- Pas d'audit sur connexions / mutations admin.
- Pas de rétention configurée (TTL).

## Options

### Option 1 — Middleware Prisma global

Audit systématique de toutes les opérations CRUD sur les entités métier.

Avantages :
- Couverture exhaustive.
- Traçabilité complète.
- Pas d'oubli d'actions critiques.

Inconvénients :
- Impact performance.
- Volume de logs important.
- Complexité de filtrage.

### Option 2 — Service ciblé

Audit explicite dans les services métier pour les actions critiques définies.

Avantages :
- Maîtrise du périmètre.
- Performance préservée.
- Logs pertinents.

Inconvénients :
- Risque d'oubli d'actions critiques.
- Maintenance à chaque nouvelle fonctionnalité.

### Option 3 — Hybride

Middleware pour actions générales (connexions, mutations admin) + service
ciblé pour actions métier spécifiques.

Avantages :
- Équilibre exhaustivité / maîtrise.
- Flexibilité.

Inconvénients :
- Complexité de coordination.
- Double maintenance.

## Décision

**Report de l'extension de la couverture d'audit à la session 20+ avec
mandat humain.**

Le présent ADR acte la décision de **ne pas implémenter** l'extension en
S19. Les raisons :

1. Les décisions d'architecture (périmètre d'audit, choix middleware vs
   service, TTL) nécessitent une validation explicite de l'humain.
2. Le risque de régression en fin de S19 est trop élevé pour une
   implémentation non préparée.
3. La dette est documentée, les options sont clarifiées : l'implémentation
   peut être démarrée en S20+ sans blocage.

## Questions à trancher (S20+)

1. **Périmètre** : quelles actions doivent être auditées ?
   - Connexions / déconnexions ?
   - Création / modification / suppression de toutes les entités métier ?
   - Actions admin (reset, purge, sync) ?
   - Échecs d'authentification (au-delà de Tauri) ?

2. **Approche** : middleware Prisma global, service ciblé, ou hybride ?

3. **Rétention** : faut-il un TTL sur audit_logs ? Si oui, quelle durée
   (30 jours, 90 jours, 1 an) ?

4. **Exposition** : faut-il exposer audit_logs via une route admin ? Si
   oui, quel format (table, export CSV) ?

5. **Performance** : quel est le volume maximal acceptable d'audit_logs
   par jour ? Faut-il un mécanisme de purge automatique ?

## Plan d'implémentation (S20+)

### Étape 1 — Validation du périmètre par l'humain

- Répondre aux 5 questions ci-dessus.
- Valider le choix d'approche (middleware / service / hybride).

### Étape 2 — Implémentation du middleware / service d'audit

- Si middleware : créer un middleware Prisma générique, l'enregistrer
  dans prisma.config.ts ou src/lib/database/connection-manager.ts.
- Si service ciblé : ajouter les appels prisma.auditLog.create() dans
  les services métier concernés.
- Si hybride : combiner les deux approches.

### Étape 3 — Configuration de la rétention

- Implémenter un job de purge automatique (cron ou node-cron) si TTL
  décidé.
- Ajouter un test de non-régression pour vérifier que le purge ne
  supprime pas les logs récents.

### Étape 4 — Exposition admin

- Créer une route API GET /api/admin/audit-logs (si décidé).
- Ajouter un composant UI dans le dashboard admin.

### Étape 5 — Tests de non-régression

- Vérifier que les 3 actions existantes (PROCEDURE_ARCHIVED,
  PROCEDURE_DELETED, TAURI_TOKEN_FAILED) continuent de fonctionner.
- Vérifier que le truncate admin/reset ne casse pas les nouvelles règles
  de rétention.

### Étape 6 — Documentation

- Mettre à jour docs/WORK_GUIDE.md (section 7 BDD/Neon) avec les
  nouvelles règles d'audit.
- Mettre à jour docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md avec le statut
  « implémenté ».

## Règles de non-régression

- Conserver les 3 actions existantes : PROCEDURE_ARCHIVED,
  PROCEDURE_DELETED, TAURI_TOKEN_FAILED.
- Ne pas modifier POST /api/admin/reset sans validation explicite de
  l'humain (impact sur la rétention).
- Ne pas ajouter d'appel d'audit dans une boucle critique sans mesure de
  performance.
- Tester après chaque ajout d'action d'audit (unit test + intégration).

## Références

- docs/NOTE_AUDIT_LOGS_DIAGNOSTIC.md — diagnostic complet (S18).
- docs/INCIDENT_2026-10-02.md — mention initiale « audit_logs toujours
  à 0 » (ligne 137, reformulée S19).
- docs/DB_STATE_2026-10-02.md — snapshot T1, audit_logs = 0.
- docs/adr/007-withauth-async-await.md — format de référence.
- prisma/schema.prisma — modèle AuditLog (lignes 295-313).
- src/lib/services/procedures.service.ts — 2 appels d'audit (lignes 162,
  178).
- src/app/api/tauri-auth/token/route.ts — 1 appel d'audit (ligne 45).
- src/app/api/admin/reset/route.ts — truncate audit_logs (ligne 15).