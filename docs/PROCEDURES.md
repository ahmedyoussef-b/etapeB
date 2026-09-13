# NexaFlow — Procédures opérationnelles

Documentation détaillée des deux modules liés aux procédures :

1. **Créer une procédure** — l'interface de création et d'édition avancée
2. **Guide procédure** — l'exécution guidée assistée par IA

---

## 1. Créer une procédure

### 1.1 Accès

- **Sidebar** → bouton *« Créer une procédure »* (icône `FileText`) → `/creer-procedure`
- **Dashboard Chef de bloc / Chef de quart** → bouton *« Créer une procédure »* dans `QuickActions`
- **Permission requise** : `procedures:create` (Chef de bloc, Chef de quart, Admin)

### 1.2 Page et point d'entrée

**Fichier :** `src/app/(dashboard)/creer-procedure/page.tsx`

La page charge le composant `CreateProcedureForm` (`src/components/creer-procedure-form.tsx`), qui délègue à `DynamicProcedureForm` (`src/components/procedures/forms/DynamicProcedureForm.tsx`).

### 1.3 Architecture fonctionnelle

```
page.tsx (creer-procedure)
  └─ CreateProcedureForm (creer-procedure-form.tsx)
     └─ DynamicProcedureForm
          ├─ MetadataEditor      (édition des métadonnées)
          ├─ StepEditor          (édition des étapes, drag-and-drop)
          ├─ ProcedureTimeline   (mini-plan interactif)
          ├─ ProcedureChecklist  (checklist de complétude)
          └─ VersionHistoryDialog (historique des versions)
```

### 1.4 Gestion de l'état

Le formulaire utilise un **state local** (`useState<TProcedure>`) initialisé depuis :

- Le dernier brouillon enregistré dans `localStorage` (clé `nexaflow_procedures`)
- Un vide `createEmptyProcedure()` si aucun brouillon n'existe

Les mutations utilisent des fonctions purement immuables du service `procedure-manager.service.ts` :

| Fonction | Description |
|----------|-------------|
| `createEmptyProcedure()` | Procédure vierge avec métadonnées par défaut |
| `addStep(procedure)` | Ajoute une étape vide (type `consigne_simple`) |
| `removeStep(procedure, stepId)` | Supprime une étape et réindexe l'ordre |
| `duplicateStep(procedure, stepId)` | Duplique une étape (titre suffixé `(copie)`) |
| `reorderSteps(procedure, from, to)` | Réorganise par drag-and-drop (dnd-kit) |
| `updateStep(procedure, stepId, updates)` | Applique des mises à jour partielles |
| `updateMetadata(procedure, metadata)` | Met à jour les métadonnées |

### 1.5 Métadonnées de la procédure

**Fichier :** `src/components/procedures/forms/MetadataEditor.tsx`

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `title` | texte | Oui | Titre affiché dans l'interface |
| `code` | texte | Oui | Identifiant unique (ex: `PROC-2026-001`) |
| `description` | texte long | Non | Description contextuelle (markdown léger) |
| `category` | enum | Oui | `production`, `maintenance`, `securite`, `qualite`, `logistique`, `environnement` |
| `priority` | enum | Oui | `basse`, `moyenne`, `haute`, `critique` |
| `estimatedTimeMinutes` | nombre | Oui | Durée estimée (>= 1) |
| `requiredRoles` | tableau de strings | Oui | Rôles autorisées (`chef_de_quart`, `chef_de_bloc`, `rondier`, `technicien`, `superviseur`) |
| `globalSafetyInstructions` | tableau de strings | Oui | Consignes de sécurité globales |

**Validation** : Le formulaire utilise `react-hook-form` avec `zodResolver(MetadataSchema)` pour la validation côté client en temps réel.

### 1.6 Étapes de la procédure

**Fichier :** `src/components/procedures/forms/StepEditor.tsx`

Chaque étape (`TStep`) possède les propriétés suivantes :

#### 1.6.1 Propriétés de base

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (généré : `step_${Date.now()}_${random}`) |
| `title` | texte | Titre de l'étape (requis) |
| `subtitle` | texte | Sous-titre optionnel |
| `instructions` | texte long | Instructions détaillées pour l'opérateur (requis) |
| `type` | enum | Type d'étape |
| `isMandatory` | booléen | Étape obligatoire / bloquante |
| `order` | nombre | Position dans la séquence |

#### 1.6.2 Types d'étape

Définis dans `src/lib/procedures/services/validator.service.ts` via `StepTypeSchema` :

| Type | Label | Description |
|------|-------|-------------|
| `consigne_simple` | Consigne simple | Instructions à suivre |
| `saisie_donnees` | Saisie de données | Saisie de valeurs numériques |
| `inspection_visuelle` | Inspection visuelle | Vérification visuelle d'équipements |
| `validation_securite` | Validation de sécurité | Points critiques de sécurité |
| `mesure_numerique` | Mesure numérique | Prise de mesures avec un appareil |

#### 1.6.3 Chronomètre

- `timerEnabled` : active ou désactive le chronomètre pour l'étape
- `timerSeconds` : durée en secondes (>= 0)
- Un timer dépassé génère une anomalie enregistrée : `Temps écoulé pour l'étape: <titre>`

#### 1.6.4 Dépendances

- `dependencies` : tableau d'IDs d'étapes prérequis
- Un bouton `Badge` par étape permet d'ajouter/retirer des dépendances
- **Détection automatique des dépendances circulaires** via `hasCircularDependencies()` (DFS)

#### 1.6.5 Captures média

**Fichier :** `src/components/procedures/forms/MediaCaptureField.tsx`

Types de média supportés :

| Type | Label | Taille max |
|------|-------|------------|
| `photo` | Photo | 10 Mo |
| `video` | Vidéo | 50 Mo |
| `audio` | Enregistrement audio | 20 Mo |
| `signature` | Signature numérique | 2 Mo |

Options pour chaque capture :
- `mandatory` : Obligatoire pour valider l'étape
- `geolocation` : Enregistrer les coordonnées GPS
- `timestamp` : Horodater la capture

#### 1.6.6 Alertes et sécurité

**Fichier :** `src/components/procedures/shared/AlarmDisplay.tsx`

Chaque alerte (`TAlarmConfig`) contient :

| Champ | Type | Description |
|-------|------|-------------|
| `condition` | texte | Condition déclenchante (ex: `Température > 80°C`) |
| `threshold` | texte | Seuil optionnel |
| `type` | enum | `DANGER`, `WARNING`, `INFO`, `SECURITY_CHECK` |
| `message` | texte | Message d'alerte / consignes d'urgence |

Types d'alerte avec couleurs :

| Type | Couleur | Icône |
|------|---------|-------|
| `DANGER` | `border-l-alarm-danger bg-alarm-danger-bg` | `AlertTriangle` |
| `WARNING` | `border-l-alarm-warning bg-alarm-warning-bg` | `AlertCircle` |
| `INFO` | `border-l-alarm-info bg-alarm-info-bg` | `Info` |
| `SECURITY_CHECK` | `border-l-alarm-security bg-alarm-security-bg` | `Shield` |

#### 1.6.7 Pièces jointes

- `attachments` : liste de noms de fichiers/références
- Ajout par `Enter` dans un champ texte
- Suppression via `Trash2` dans chaque badge

### 1.7 Barre d'outils et actions

**Fichier :** `src/components/procedures/forms/DynamicProcedureForm.tsx` (lignes 219-293)

| Action | Icône | Raccourci clavier | Description |
|--------|-------|-------------------|-------------|
| Importer JSON | `Upload` | — | Charge un fichier JSON validant le schema |
| Sauvegarder brouillon | `Save` | `Ctrl/Cmd + S` | Sauvegarde dans localStorage + BDD via versioning |
| Valider & Exporter | `Download` | `Ctrl/Cmd + E` | Valide puis télécharge en JSON |
| Réinitialiser | `RotateCcw` | — | Efface le formulaire |
| Historique des versions | `History` | — | Ouvre le dialogue de versions |
| Mode compact | `Eye / EyeOff` | — | Réduit la largeur des cartes d'étapes |
| Checklist | `Eye / EyeOff` | — | Affiche/masque la checklist de complétude |

### 1.8 Sauvegarde et versioning

#### 1.8.1 Sauvegarde locale (brouillon)

- `saveProcedure(procedure)` : valide via `ProcedureSchema.parse()` puis écrit dans `localStorage` sous la clé `nexaflow_procedures`
- Fonction synchrone, utilisée en fallback

#### 1.8.2 Sauvegarde serveur (versionnage)

**Fichier :** `src/lib/procedures/services/procedure-manager.service.ts` — `saveProcedureVersion()`

Flux :

1. Validation Zod (`ProcedureSchema.parse`)
2. `POST /api/procedures/guide/{code}/save` → `procedureVersionService.saveWithVersion()`
3. Sur succès : la procédure est écrite dans la base via un **@transaction Prisma**
4. Sur échec : sauvegarde locale automatique, l'erreur est propagée

#### 1.8.3 Versioning côté serveur

**Fichier :** `src/lib/procedures/services/procedure-version.service.ts`

Le versionnage utilise la table `Document` (Prisma) :

```
registry/procedures/{code}/procedure.json        → dernière version
registry/procedures/{code}/{code}_v{n}.json      → versions archivées
```

Processus de `saveWithVersion(code, procedure)` :

1. Recherche des documents existants sous `registry/procedures/{code}/`
2. Détermination du prochain numéro de version (`maxVersion + 1`)
3. **Transaction Prisma** :
   - Déplace `procedure.json` (latest) vers `{code}_v{n}.json` (si existant)
   - Écrit la nouvelle version dans `procedure.json`
   - Upsert dans la table `Procedure` (liste des procédures)
4. Retourne `{ id, code, version, path, data, createdAt }`

#### 1.8.4 API de versioning

| Endpoint | Méthode | Permission | Description |
|----------|---------|------------|-------------|
| `/api/procedures/guide/{code}/save` | POST | `procedures:create` | Sauvegarde une nouvelle version |
| `/api/procedures/guide/{code}/versions` | GET | `procedures:view` | Liste toutes les versions |
| `/api/procedures/guide/{code}/version/{version}` | GET | `procedures:view` | Récupère une version spécifique |

**Note :** La route `[version]/[version]` référencée dans le code client (`procedure-manager.service.ts` ligne 154) n'a pas de route API correspondante implémentée serveur — uniquement `[versions]` (list) et `[save]`.

#### 1.8.5 Dialogue d'historique des versions

**Fichier :** `src/components/procedures/VersionHistoryPanel.tsx`

- Affiche les versions archivées sous forme de liste
- Chaque version : badge `v{n}`, titre, date de création
- Fonctionnalités :
  - **Sélection** : cocher jusqu'à 2 versions pour comparaison
  - **Restaurer** : rétablit une version (callback `onRestore`)
  - **Comparer** : compare 2 versions (callback `onCompare` — placeholder)

### 1.9 Import / Export

#### 1.9.1 Import de JSON

Deux points d'import :

1. **Page Guide procédure** (`guide-procedure/page.tsx`) :
   - Bouton *« Importer JSON »* → `importProcedure(parsed)` + `saveProcedureVersion(parsed)`
   - Sauvegarde dans localStorage ET synchro serveur

2. **Formulaire de création** (`DynamicProcedureForm`) :
   - Bouton *« Importer JSON »* → `validateProcedure(parsed)` (Zod)
   - Charge la procédure validée dans le formulaire

**Validation** : `JSON.parse` → `ProcedureSchema.parse()` (Zod). L'erreur est affichée via `toast.error()`.

#### 1.9.2 Export

- `exportToJson(procedure)` : sérialise via `ProcedureSchema.parse()` puis `JSON.stringify(..., null, 2)`
- `downloadJson(procedure, filename?)` : crée un Blob, génère un URL objet, déclenche un `<a download>`
- Fonctionne uniquement si la procédure est validée (sinon erreur Zod)
- **Raccourci clavier** : `Ctrl/Cmd + E` → valide d'abord, puis exporte

### 1.10 Checklist de complétude

**Fichier :** `src/components/procedures/ProcedureChecklist.tsx`

Checklist dynamique avec pondération :

| Critère | Poids | Condition |
|---------|-------|-----------|
| Titre renseigné | 10 | `metadata.title.trim() !== ""` |
| Code renseigné | 5 | `metadata.code.trim() !== ""` |
| Catégorie | 5 | `metadata.category` non vide |
| Priorité | 5 | `metadata.priority` non vide |
| Étapes définies | 15 | `steps.length > 0` |
| Titres d'étapes | 10 | Toutes les étapes ont un titre |
| Instructions | 10 | Au moins une étape a des instructions |
| Étape obligatoire | 5 | Au moins une étape `isMandatory` |
| Consignes de sécurité | 10 | `globalSafetyInstructions.length > 0` |
| Rôles requises | 5 | `requiredRoles.length > 0` |
| Durée estimée | 5 | `estimatedTimeMinutes > 0` |
| Pas de dépendances circulaires | 15 | `!hasCircularDependencies(steps)` |

Score affiché : pourcentage de poids complétés.
Badge couleur : `Complet` (>=80%), `En cours` (>=50%), `À améliorer` (<50%).

### 1.11 Synchronisation offline

Le système fonctionne avec un **fallback offline-first** :

1. **localStorage** (`nexaflow_procedures`) : cache client pour la création/édition
2. **Server store** (`.local-db/procedures/procedures.json`) : fallback serveur si PostgreSQL indisponible
3. **Queue de synchronisation** : les opérations sont mises dans une file (`enqueueSyncOperation`) et rejouées quand la BDD redevient disponible (`replaySyncQueue`)

#### 1.11.1 Circuit breaker et fallback

**Fichier :** `src/lib/services/procedures.fallback.ts`

| Fonction | Description |
|----------|-------------|
| `safeGetAllProcedures()` | Récupère depuis la BDD ou le fallback localStorage |
| `safeGetProcedureByCode(code)` | Recherche par code |
| `safeUpsertProcedure(procedure)` | Crée ou met à jour |
| `safeDeleteProcedure(code)` | Supprime |
| `safeSaveProcedureVersion(code, procedure)` | Versionnage avec fallback |
| `safeGetProcedureLatest(code)` | Dernière version |
| `safeListProcedureVersions(code)` | Liste des versions |
| `replaySyncQueue()` | Rejoue la queue de sync |

---

## 2. Guide procédure

### 2.1 Accès

- **Sidebar** → bouton *« Guide procédure »* (icône `BookOpen`) → `/guide-procedure`
- **Permission requise** : `procedures:view` (tous les rôles sauf Rondier)
- **Page :** `src/app/(dashboard)/guide-procedure/page.tsx`

### 2.2 Vue d'ensemble de la page

La page d'accueil du Guide procédure (`src/app/(dashboard)/guide-procedure/page.tsx`) offre deux actions :

1. **Importer JSON** — charge un fichier de procédure depuis le disque
2. **Créer une procédure** — redirige vers `/creer-procedure`

Si aucune procédure n'est disponible, un état vide (`Card`) s'affiche.

### 2.3 Import de procédure

**Service :** `src/lib/procedures/services/procedure-manager.service.ts` → `importProcedure()`

1. L'utilisateur sélectionne un fichier JSON
2. Le contenu est parsé et validé via `ProcedureSchema.parse()`
3. La procédure est sauvegardée dans `localStorage`
4. Tentative de synchronisation serveur via `saveProcedureVersion()`
5. La liste locale est rafraîchie

### 2.4 Lancement d'un guide

- Les procédures listées depuis la BDD ou le localStorage sont accessibles via `/procedures/guide/{code}`
- **Page serveur :** `src/app/procedures/guide/[id]/page.tsx` → chargement côté serveur
- **Composant client :** `src/app/procedures/guide/[id]/ProcedureGuidePageClient.tsx`

#### 2.4.1 Chargement de la procédure

1. `GET /api/procedures/guide/{code}` → `safeGetProcedureByCode()`
2. Si la BDD est indisponible → fallback sur `localStorage` via `getProcedureById()`
3. Si 404 → message d'erreur avec lien de retour vers `/guide-procedure`

### 2.5 Architecture de l'exécution guidée

```
ProcedureGuide (wrapper UI)
  └─ ProcedureExecutor (useProcedureExecution hook)
     ├─ BriefingStage         (phase: "briefing")
     ├─ PrerequisitesStage    (phase: "prerequisites")
     ├─ RunningStage          (phase: "executing")
     │    └─ StepGuide        (affiche l'étape courante)
     │         └─ MediaCapture (capture photo/vidéo/audio/signature)
     ├─ CompletedStage        (phase: "completed")
     └─ AbortedStage          (phase: "aborted")
```

### 2.6 Phases de l'exécution

#### 2.6.1 Briefing (`briefing`)

**Fichier :** `src/components/procedures/execution/BriefingStage.tsx`

Affiche un résumé avant le lancement :

- Titre et code de la procédure
- Durée estimée (`metadata.estimatedTimeMinutes`)
- Catégorie
- Nombre d'étapes
- Description / contexte opérationnel
- **Consignes de sécurité globales** (icône `ShieldAlert`)
- **Badge de priorité** (couleur selon le niveau)
- Bouton *« Démarrer le guide »* → passe à la phase `prerequisites`

#### 2.6.2 Prérequis (`prerequisites`)

**Fichier :** `src/components/procedures/execution/PrerequisitesStage.tsx`

Construction dynamique des prérequis via `buildPrerequisites()` :

| Prérequis | Condition |
|-----------|-----------|
| Habillitudes vérifiées | Toujours (affiche les `requiredRoles`) |
| Consignes de sécurité | Si `globalSafetyInstructions.length > 0` |
| Équipements de capture | Si la première étape a des `mediaRequirements` |
| Points d'alerte | Si la première étape a des `alarms` |
| Temps disponible | Si `estimatedTimeMinutes > 0` |
| Environnement sécurisé | Toujours |

- Tous les prérequis doivent être cochés pour activer le bouton *« Valider les prérequis »*
- Clique → démarre le timer et passe à la phase `executing`

#### 2.6.3 Exécution (`executing`)

**Fichier :** `src/components/procedures/execution/RunningStage.tsx`

##### Navigation

| Action | Description |
|--------|-------------|
| `Précédent` (`SkipBack`) | Étape précédente (désactivé si première) |
| `Marquer effectuée` (`CheckCircle2`) | Bascule l'état complétée de l'étape |
| `Suivant` (`SkipForward`) | Étape suivante (déclenche la complétude de l'étape courante) |
| `Terminer la procédure` | Dernière étape → passe à `completed` |

##### Barre de progression

- Barre circulaire en haut (`${progress}%`)
- Boutons d'étapes circulaires en haut (numérotés, couleur selon l'état)
- `bg-primary` pour l'étape courante, `bg-primary/10` pour les étapes passées, `bg-muted` pour les futures

##### Affichage de l'étape (`StepGuide`)

**Fichier :** `src/components/procedures/execution/StepGuide.tsx`

Pour chaque étape, affiche :

1. **En-tête** : icône du type, titre, sous-titre, badge de type, numéro d'étape
2. **Instructions** : texte formaté dans une carte
3. **Métadonnées** :
   - Checkbox *obligatoire* (désactivée, indicatif)
   - Checkbox *marquer effectuée*
   - Chronomètre (si activé) : format `MM:SS`
4. **Captures média** : badges avec type, obligation, géolocalisation, horodatage
5. **Alertes** : cadres colorés selon le type avec condition, seuil et message
6. **Pièces jointes** : badges `Paperclip`
7. **Conseil IA** : encadré `ShieldAlert` avec conseil contextuel

##### Capture de médias

**Fichier :** `src/components/procedures/execution/MediaCapture.tsx`

- Capture via `MediaCaptureField` (voir §1.6.5)
- Envoi vers `POST /api/procedures/execution/media`
- Validation de taille côté serveur (voir tableau des tailles max)
- Géolocalisation et horodatage en option
- Les médias sont stockés dans la table `ProcedureMedia` (Prisma) :

| Colonne | Type | Description |
|---------|------|-------------|
| `procedureId` | String | ID de la procédure |
| `procedureCode` | String | Code de la procédure |
| `stepId` | String | ID de l'étape |
| `stepOrder` | Int | Ordre de l'étape |
| `type` | String | `photo`, `video`, `audio`, `signature` |
| `filename` | String | Nom du fichier |
| `mimeType` | String | Type MIME |
| `size` | Int | Taille en octets |
| `data` | Bytes | Données binaires |
| `geolocation` | Json? | Coordonnées GPS |
| `capturedAt` | DateTime | Horodatage |
| `uploadedBy` | String? | Auteur |
| `metadata` | Json? | Métadonnées |

#### 2.6.4 Assistants IA et vocal

**Hook :** `src/lib/procedures/hooks/useProcedureExecution.ts`

##### Assistant IA (panneau latéral droit)

- `generateAssistantAdvice(payload)` depuis `src/lib/procedures/assistants/mock-assistant.ts`
- Conseils basés sur le type d'étape, le numéro, la phase, les alarmes, les médias
- Chat interactif : l'utilisateur peut poser des questions sur l'étape courante
- Réponses contextuelles basées sur des mots-clés : sécurité, média, obligatoire, temps, étape, fin, type

##### Synthèse vocale

- `useSpeech` hook (`src/lib/speech/use-speech.ts`) — API Web Speech API
- `autoRead` : lecture automatique à chaque changement d'étape
- Bouton lecture/pause manuel (`Volume2 / Pause`)
- Bouton bascule lecture auto (`Volume2 / VolumeX`)
- Langue : `fr-FR`

##### Script vocal généré

`buildStepScript()` construit un script texte à partir de :

- Numéro d'étape / total
- Titre, sous-titre, instructions
- Indicatif d'obligation
- Chronomètre activé ? durée
- Captures médias requises (type, obligation, géolocalisation, horodatage)
- Alertes configurées (type, condition, seuil, message)

### 2.6.5 Timer

Le hook `useProcedureExecution` gère un chronomètre à deux niveaux :

1. **Chronomètre d'étape** : compte à rebours si `timerEnabled && timerSeconds > 0`
   - À 0 : enregistre une anomalie `Temps écoulé pour l'étape: <titre>`
   - Désactive le timer
2. **Chronomètre global** : incrémente `globalElapsed` chaque seconde pendant l'exécution

### 2.6.6 Phase terminée (`completed`)

**Fichier :** `src/components/procedures/execution/CompletedStage.tsx`

Affiche un résumé de l'exécution :

- Titre et code de la procédure
- **Durée totale** (formatée : `X min Y s`)
- **Étapes effectuées** : `context.completedSteps.size / procedure.steps.length`
- **Anomalies** : liste avec icône `XCircle`
- **Médias capturés** : miniatures (photos, vidéos, audio, signatures) avec :
  - Badge de statut (uploadé / non)
  - Taille en KB
  - Géolocalisation si disponible
- Bouton *« Fermer »* → retour à `/guide-procedure`

### 2.6.7 Phase interrompue (`aborted`)

**Fichier :** `src/components/procedures/execution/AbortedStage.tsx`

Affiche :

- Titre et code de la procédure
- **Motif d'interruption** (dernière anomalie ou "Interruption")
- **Anomalies enregistrées** : liste complète
- **Statistiques** : heure de début, étapes effectuées
- Bouton *« Fermer »*

### 2.7 Hook d'exécution (`useProcedureExecution`)

**Fichier :** `src/lib/procedures/hooks/useProcedureExecution.ts`

#### 2.7.1 State géré

```typescript
{
  phase: GuidePhase;                    // "briefing" | "prerequisites" | "executing" | "completed" | "aborted"
  currentStep: TStep | null;            // Étape courante
  currentStepIndex: number;             // Index dans le tableau trié
  totalSteps: number;                   // Nombre total d'étapes
  completedSteps: Set<string>;          // IDs des étapes complétées
  context: ProcedureExecutionContext;    // Contexte d'exécution
  timer: {                              // Contrôle du chronomètre
    stepRemaining, globalElapsed, isRunning, isPaused,
    start, pause, resume, stop, reset
  };
  actions: {                            // Actions disponibles
    goToStep, nextStep, previousStep, completeStep,
    setPhase, abort, reset, addCapturedMedia, removeCapturedMedia
  };
}
```

#### 2.7.2 Gestion des médias

`saveCapturedMedia()` envoie les médias non uploadés via `POST /api/procedures/execution/media` :

- Corps de la requête : `{ procedureId, procedureCode, stepId, stepOrder, media: { name, base64, type, mimeType, geolocation, metadata } }`
- Base64 décodé en `Buffer` côté serveur
- Après upload réussi : marque le média `uploaded: true` dans le contexte

#### 2.7.3 Gestion des phases

| Transition | Action |
|------------|--------|
| `briefing` → `prerequisites` | Bouton *« Démarrer le guide »* |
| `prerequisites` → `executing` | Bouton *« Valider les prérequis »* (déclenche `timer.start()`) |
| `executing` → `completed` | Bouton *« Terminer »* sur la dernière étape |
| `executing` → `aborted` | `abort(reason)` — interruption manuelle ou timer dépassé |
| `executing` → `completed` | `nextStep()` sur la dernière étape |

---

## 3. Schéma de données JSON

### 3.1 Structure complète

```json
{
  "metadata": {
    "title": "Démarrage du système de filtration CRF",
    "code": "CRF-START-001",
    "description": "Procédure de démarrage sécurisé...",
    "category": "production",
    "priority": "haute",
    "estimatedTimeMinutes": 25,
    "requiredRoles": ["technicien", "chef_de_quart"],
    "globalSafetyInstructions": [
      "Porter les EPI obligatoires : casque, gants, lunettes de protection.",
      "Vérifier l'absence de pression dans les conduites avant toute intervention."
    ]
  },
  "steps": [
    {
      "id": "step_1",
      "title": "Vérification préalable de l'installation",
      "subtitle": "Contrôles visuels et fonctionnels",
      "instructions": "Inspecter l'ensemble des filtres, joints et raccords...",
      "type": "inspection_visuelle",
      "isMandatory": true,
      "dependencies": [],
      "mediaRequirements": [
        {
          "type": "photo",
          "mandatory": true,
          "options": {
            "geolocation": true,
            "timestamp": true
          }
        }
      ],
      "alarms": [
        {
          "condition": "Fuite détectée",
          "threshold": "Oui",
          "type": "DANGER",
          "message": "Arrêt immédiat. Signalement au responsable sécurité."
        }
      ],
      "attachments": ["fiche_pompe_primaire.pdf"],
      "order": 0,
      "timerEnabled": true,
      "timerSeconds": 300
    }
  ]
}
```

### 3.2 Validation (Zod)

**Fichier :** `src/lib/procedures/services/validator.service.ts`

| Schéma | Champ | Contraintes |
|--------|-------|-------------|
| `MetadataSchema` | `title` | min 1 caractère |
| | `code` | min 1 caractère |
| | `category` | min 1 caractère |
| | `priority` | enum: `basse`, `moyenne`, `haute`, `critique` |
| | `estimatedTimeMinutes` | min 1 |
| | `requiredRoles` | tableau de strings |
| | `globalSafetyInstructions` | tableau de strings |
| `StepSchema` | `id` | min 1 caractère |
| | `title` | min 1 caractère |
| | `instructions` | min 1 caractère |
| | `type` | enum des 5 types |
| | `order` | min 0 |
| | `timerSeconds` | min 0 |
| `ProcedureSchema` | `steps` | min 1 étape |

---

## 4. RBAC — Matrice des permissions

| Rôle | Permission | Accès |
|------|-----------|-------|
| **Rondier** | `procedures:view` | Non (aucune permission sur les procédures) |
| **Chef de bloc** | `procedures:view`, `procedures:create`, `procedures:edit` | Créer, exécuter, modifier |
| **Chef de quart** | `procedures:view`, `procedures:create`, `procedures:edit` | Créer, exécuter, modifier |
| **Admin** | `procedures:*` | Accès complet (créer, lire, modifier, supprimer) |

---

## 5. API — Endpoints procédures

| Endpoint | Méthode | Permission | Description |
|----------|---------|------------|-------------|
| `/api/procedures/guide` | GET | `procedures:view` | Liste toutes les procédures |
| `/api/procedures/guide` | POST | `procedures:create` | Crée/actualise une procédure |
| `/api/procedures/guide/{code}` | GET | `procedures:view` | Récupère une procédure par code |
| `/api/procedures/guide/{code}` | DELETE | `procedures:delete` | Supprime une procédure |
| `/api/procedures/guide/{code}/save` | POST | `procedures:create` | Sauvegarde une version |
| `/api/procedures/guide/{code}/versions` | GET | `procedures:view` | Liste les versions |
| `/api/procedures/execution/media` | POST | `procedures:create` | Upload de média |
| `/api/procedures/execution/media` | GET | `procedures:view` | Liste les médias |

---

## 6. Raccourcis clavier (Créer une procédure)

| Combinaison | Action |
|-------------|--------|
| `Ctrl/Cmd + S` | Sauvegarder le brouillon |
| `Ctrl/Cmd + D` | Dupliquer l'étape active |
| `Ctrl/Cmd + E` | Exporter en JSON |
| `Escape` | Fermer les erreurs de validation |

---

## 7. Fichiers de référence

| Fonctionnalité | Fichier(s) clé(s) |
|----------------|-------------------|
| Page création | `src/app/(dashboard)/creer-procedure/page.tsx` |
| Page guide | `src/app/(dashboard)/guide-procedure/page.tsx` |
| Page exécution | `src/app/procedures/guide/[id]/ProcedureGuidePageClient.tsx` |
| Formulaire dynamique | `src/components/procedures/forms/DynamicProcedureForm.tsx` |
| Éditeur métadonnées | `src/components/procedures/forms/MetadataEditor.tsx` |
| Éditeur étapes | `src/components/procedures/forms/StepEditor.tsx` |
| Capture média (form) | `src/components/procedures/forms/MediaCaptureField.tsx` |
| Alertes | `src/components/procedures/shared/AlarmDisplay.tsx` |
| Timeline | `src/components/procedures/visualization/ProcedureTimeline.tsx` |
| Checklist | `src/components/procedures/ProcedureChecklist.tsx` |
| Historique versions | `src/components/procedures/VersionHistoryPanel.tsx` |
| Guide d'exécution | `src/components/procedures/execution/ProcedureGuide.tsx` |
| Exécuteur | `src/components/procedures/execution/ProcedureExecutor.tsx` |
| Briefing | `src/components/procedures/execution/BriefingStage.tsx` |
| Prérequis | `src/components/procedures/execution/PrerequisitesStage.tsx` |
| Exécution | `src/components/procedures/execution/RunningStage.tsx` |
| Étape guidée | `src/components/procedures/execution/StepGuide.tsx` |
| Capture média (exécution) | `src/components/procedures/execution/MediaCapture.tsx` |
| Terminé | `src/components/procedures/execution/CompletedStage.tsx` |
| Interrompu | `src/components/procedures/execution/AbortedStage.tsx` |
| Service gestion | `src/lib/procedures/services/procedure-manager.service.ts` |
| Service versionnage | `src/lib/procedures/services/procedure-version.service.ts` |
| Validateur (Zod) | `src/lib/procedures/services/validator.service.ts` |
| Types | `src/lib/procedures/types.ts` |
| Hook exécution | `src/lib/procedures/hooks/useProcedureExecution.ts` |
| Assistant IA | `src/lib/procedures/assistants/mock-assistant.ts` |
| Données mock | `src/lib/procedures/mock-data.ts` |
| i18n | `src/lib/i18n/procedures.ts` |
| RBAC | `src/lib/types/rbac.ts` |
| Auth guard | `src/lib/api/auth-guard.ts` |
| API guide | `src/app/api/procedures/guide/route.ts` |
| API versionnage | `src/app/api/procedures/guide/[code]/route.ts` |
| API save version | `src/app/api/procedures/guide/[code]/save/route.ts` |
| API versions list | `src/app/api/procedures/guide/[code]/versions/route.ts` |
| API médias | `src/app/api/procedures/execution/media/route.ts` |
| Service fallback | `src/lib/services/procedures.fallback.ts` |
| Service guide | `src/lib/services/guide-procedures.service.ts` |
| Service DB | `src/lib/services/procedures.service.ts` |
| Store serveur | `src/lib/procedures/server-store.ts` |
| Store offline | `src/lib/procedures/offline-repo.ts` |
| Schema Prisma | `prisma/schema.prisma` (modèles : `Procedure`, `ProcedureMedia`, `Document`) |
