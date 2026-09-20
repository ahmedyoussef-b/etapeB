# 📋 Rapport d'audit — Module « Guide procédure »

## Tableau de synthèse

| # | Élément | Existe ? | Fichier | Action recommandée |
|---|---------|----------|---------|---------------------|
| 1 | Page `/guide-procedure` | ✅ | `src/app/(dashboard)/guide-procedure/page.tsx` | **Modifier** — remplacer le state vide par une liste de cartes |
| 2 | Composant `ProcedureCard` | ❌ | — | **Créer** (`src/components/procedures/ProcedureCard.tsx`) |
| 3 | Fonction `getProcedures()` (localStorage) | ✅ | `procedure-manager.service.ts:28` | **Réutiliser** — source client |
| 4 | Fonction `syncFromServer()` | ✅ | `procedure-manager.service.ts:53` | **Réutiliser** — sync BDD → localStorage |
| 5 | Route API `GET /api/procedures/guide` | ✅ | `src/app/api/procedures/guide/route.ts:6` | **Réutiliser** — liste toutes les procédures |
| 6 | Route API `/api/guide-procedures` (paginée) | ✅ | `src/app/api/guide-procedures/route.ts:9` | **Réutiliser optionnellement** — liste paginée |
| 7 | Types `TProcedure` / `TStep` / `TMetadata` | ✅ | `validator.service.ts:64-68` | **Réutiliser** — types Zod |
| 8 | Schéma Zod `ProcedureSchema` | ✅ | `validator.service.ts:59` | **Réutiliser** — validation |
| 9 | shadcn/ui `Card`, `Badge`, `Button` | ✅ | `src/components/ui/` | **Réutiliser** |
| 10 | shadcn/ui `DropdownMenu` | ❌ | — | **Créer** (pas installé) |
| 11 | Composant `EmptyState` | ❌ | — | **Créer** |
| 12 | Composant de recherche | ❌ | — | **Créer** |
| 13 | Hook `usePermissions` | ✅ | `src/lib/hooks/usePermissions.ts:13` | **Réutiliser** |
| 14 | Composant `PermissionGuard` | ✅ | `src/components/shared/permission-guard.tsx:14` | **Réutiliser** |
| 15 | RBAC `procedures:*` | ✅ | `src/lib/types/rbac.ts:9` | **Réutiliser** |
| 16 | `useOfflineSync` / `useOfflineEntity` | ✅ | `src/lib/hooks/` | **Existant mais non lié aux procédures** — ne pas forcer l'usage |
| 17 | `sonner` (toast) | ✅ | `package.json:63` | **Réutiliser** |
| 18 | `lucide-react` | ✅ | `package.json:53` | **Réutiliser** |
| 19 | `@dnd-kit` | ✅ | `package.json:39-41` | Existant, pas utile pour une liste de cartes |
| 20 | `react-hook-form` | ✅ | `package.json:61` | Existant, pas utile pour une recherche simple |
| 21 | Comportement `ProcedureRunner` (exécution) | ✅ | `src/components/procedures/visualization/ProcedureRunner.tsx` | **Existant mais obsolète** — `ProcedureExecutor` le remplace |
| 22 | Flux d'exécution → `/procedures/guide/{code}` | ✅ | `ProcedureGuidePageClient.tsx` | **Réutiliser** — le lien de carte doit pointer ici |

---

## 1. 📄 Page `/guide-procedure` existante

**Fichier :** `src/app/(dashboard)/guide-procedure/page.tsx`

- **Client Component** (`"use client"`)
- **Contenu actuel** : une page d'accueil statique avec :
  - Un titre *« Guides de procédures »*
  - Un bouton *« Importer JSON »* (`<input type="file" accept="application/json">`)
  - Un bouton *« Créer une procédure »* (redirige vers `/creer-procedure`)
  - Un `Card` d'état vide *« Aucune procédure pour le moment »* (toujours affiché)
- **State** : `useState<TProcedure[]>([])` + `useState(false)` pour l'import
- **Import logique** : `fileInputRef` → `file.text()` → `JSON.parse` → `importProcedure(parsed)` → `saveProcedureVersion(parsed)` → `setProcedures(getProcedures())`
- **Aucune liste de cartes** : les procédures ne sont jamais affichées sous forme de cartes, de liste ou de tableau
- **Aucune recherche, filtre ou tri**
- **Chargement initial** : `getProcedures()` (localStorage) au `useEffect` initial — mais la page n'initialise jamais l'état avec cette fonction (le `[]'` initial reste vide)

**Extrait clé :**
```typescript
// Ligne 36 — seul appel à getProcedures(), mais le résultat n'est pas utilisé au rendu
setProcedures(getProcedures());
```
→ **Bug** : la liste `procedures` n'est jamais initialisée au montage. Le state vide persiste. La page affiche toujours l'état vide.

---

## 2. 🎴 Composant `ProcedureCard`

**Recherche :** Aucun fichier correspondant. Aucune occurrence de `ProcedureCard` ou `ProcedureListRow` dans tout le projet.

**Conclusion :** ❌ **N'existe pas.**

→ Il faut **créer** un composant `ProcedureCard.tsx` dans `src/components/procedures/`.

**Props recommandées :**
```typescript
interface ProcedureCardProps {
  procedure: TProcedure;
  onClick?: () => void;
}
```

**Elements à réutiliser pour le design :**
- `src/components/procedures/ProcedureChecklist.tsx` : logique de calcul de complétude (ponctuation 100 points)
- `src/components/procedures/forms/MetadataEditor.tsx` : logique de rôle/badge de priorité
- `src/components/dashboard/block-procedures.tsx` : pattern de carte liste avec badge de statut

---

## 3. 🔧 Service `getAllProcedures` / `getProcedures`

### 3.1 `getProcedures()` — localStorage (client)

**Fichier :** `src/lib/procedures/services/procedure-manager.service.ts:28`

```typescript
export function getProcedures(): TProcedure[] {
  return [...cachedProcedures];
}
```

- **Sync** — lit depuis `cachedProcedures` (initialisé depuis `localStorage` clé `nexaflow_procedures`)
- **Cache** : variable module-level `let cachedProcedures = loadFromStorage()`
- **Pas de gestion d'erreur** — retourne `[]` si localStorage vide/corrompu

### 3.2 `syncFromServer()` — sync serveur → localStorage

**Fichier :** `src/lib/procedures/services/procedure-manager.service.ts:53`

```typescript
export async function syncFromServer(): Promise<TProcedure | null> {
  const response = await fetch("/api/procedures/guide", { method: "GET", cache: "no-store" });
  const procedures: TProcedure[] = await response.json();
  // Merge Map par code (localStorage + serveur)
  const merged = new Map<string, TProcedure>();
  for (const p of cachedProcedures) merged.set(p.metadata.code, p);
  for (const p of procedures) merged.set(p.metadata.code, p);
  const mergedArray = Array.from(merged.values());
  replaceProcedures(mergedArray);
  return mergedArray[mergedArray.length - 1];
}
```

- **Merge** : localStorage + serveur (serveur écrase localStorage pour le même code)
- **Fallback** : retourne `null` en cas d'erreur réseau

### 3.3 `safeGetAllProcedures()` — serveur avec fallback

**Fichier :** `src/lib/services/procedures.fallback.ts:6`

```typescript
export async function safeGetAllProcedures() {
  if (!isDatabaseAvailable() || !canUseFallback()) {
    return localStore.getAllProceduresLocal(); // .local-db/procedures/procedures.json
  }
  const { result } = await executeWithDatabaseTimed(async (prisma) => {
    return await getAllProcedures();
  });
  return result;
}
```

- **Circuit breaker** + **fallback throttle** (`canUseFallback()`)
- **Deux niveaux de fallback** : PostgreSQL → `.local-db/procedures/procedures.json`

### 3.4 `getAllProcedures()` — Prisma

**Fichier :** `src/lib/services/procedures.service.ts:58`

```typescript
export async function getAllProcedures(): Promise<TProcedure[]> {
  return executeWithDatabase(async (prisma) => {
    const rows = await prisma.procedure.findMany({
      orderBy: { createdAt: 'desc' },
      select: { /* id, code, title, ... */ },
    });
    return rows.map(fromPrismaProcedure);
  });
}
```

### 3.5 `importProcedure()`

**Fichier :** `src/lib/procedures/services/procedure-manager.service.ts:262`

```typescript
export function importProcedure(procedure: TProcedure): void {
  const validated = ProcedureSchema.parse(procedure);
  const idx = cachedProcedures.findIndex((p) => p.metadata.code === validated.metadata.code);
  if (idx >= 0) {
    cachedProcedures[idx] = validated; // update
  } else {
    cachedProcedures.push(validated);   // add
  }
  saveToStorage(cachedProcedures);
}
```

- Valide via Zod → upsert dans cache → persiste localStorage
- **Pas de sync serveur** — utilisé uniquement côté client

### 3.6 Conclusion

| Besoin | Fonction existante |
|--------|-------------------|
| Lister procédures (client) | ✅ `getProcedures()` |
| Sync serveur → client | ✅ `syncFromServer()` |
| Lister procédures (serveur) | ✅ `safeGetAllProcedures()` / `getAllProcedures()` |
| Importer une procédure | ✅ `importProcedure()` |

---

## 4. 🌐 Routes API liées aux procédures

### 4.1 `/api/procedures/guide` — CRUD principal

**Fichier :** `src/app/api/procedures/guide/route.ts`

| Méthode | Permission | Corps | Retour |
|---------|-----------|-------|--------|
| GET | `procedures:view` | — | `TProcedure[]` (tableau plat) |
| POST | `procedures:create` | `{ metadata, steps }` | `TProcedure` (201) |

- Utilise `withAuth` wrapper (rate limiting 20 req/min + auth NextAuth)
- GET : `safeGetAllProcedures()` → fallback localStorage
- POST : `safeUpsertProcedure(body)` → replanifie sync queue

### 4.2 `/api/procedures/guide/{code}` — Détails / suppression

**Fichier :** `src/app/api/procedures/guide/[code]/route.ts`

| Méthode | Permission | Retour |
|---------|-----------|--------|
| GET | `procedures:view` | `TProcedure` ou 404 |
| DELETE | `procedures:delete` | `{ success: true }` ou 404 |

### 4.3 `/api/procedures/guide/{code}/save` — Versioning

**Fichier :** `src/app/api/procedures/guide/[code]/save/route.ts`

| Méthode | Permission | Corps | Retour |
|---------|-----------|-------|--------|
| POST | `procedures:create` | `TProcedure` | `VersionedProcedure` |

### 4.4 `/api/procedures/guide/{code}/versions` — Historique

**Fichier :** `src/app/api/procedures/guide/[code]/versions/route.ts`

| Méthode | Permission | Retour |
|---------|-----------|--------|
| GET | `procedures:view` | `VersionedProcedure[]` |

### 4.5 `/api/procedures/guide/{code}/version/{version}` — Version spécifique

- **Référencé** dans `procedure-manager.service.ts:154` (`getProcedureVersion`)
- **Route API NON implémentée** côté serveur — 404 si appelée

### 4.6 `/api/guide-procedures` — Variante paginée (alternative)

**Fichier :** `src/app/api/guide-procedures/route.ts`

| Méthode | Permission | Paramètres | Retour |
|---------|-----------|------------|--------|
| GET | `procedures:view` | `page`, `pageSize` | `{ data, total, page, pageSize, totalPages }` |
| POST | `procedures:create` | `TProcedure` | `TProcedure` (201) |

- Variante **paginée** du même service
- Utilise `listGuideProcedures()` → `guide-procedures.service.ts:127`

### 4.7 `/api/guide-procedures/{id}` — Détails par ID

**Fichier :** `src/app/api/guide-procedures/[id]/route.ts`

- GET seulement
- Retourne une procédure par `id` (Prisma PK) ou `code`

### 4.8 `/api/procedures/execution/media` — Médias d'exécution

**Fichier :** `src/app/api/procedures/execution/media/route.ts`

- POST : upload de média (photo, vidéo, audio, signature) avec validation taille
- GET : liste des médias filtrables par `procedureId` / `procedureCode` / `stepId`

### 4.9 `/api/guide-procedures` vs `/api/procedures/guide` — **CONFLIT**

Il existe **deux systèmes parallèles** :

| API | Service | Style | Fallback |
|-----|---------|-------|----------|
| `/api/procedures/guide` | `procedures.fallback.ts` | `safeGetAllProcedures()` | localStorage + `.local-db/procedures/` |
| `/api/guide-procedures` | `guide-procedures.service.ts` | `listGuideProcedures()` | localStorage + `.local-db/procedures/` |

**→ Recommandation :** Utiliser `/api/procedures/guide` (plus récent, plus complet) pour la liste de cartes. Ne pas mélanger les deux.

---

## 5. 🧩 Types `TProcedure`

**Fichier :** `src/lib/procedures/services/validator.service.ts`

```typescript
// Ligne 64-68
export type TMetadata = z.infer<typeof MetadataSchema>;
export type TStep = z.infer<typeof StepSchema>;
export type TMediaRequirement = z.infer<typeof MediaRequirementSchema>;
export type TAlarmConfig = z.infer<typeof AlarmConfigSchema>;
export type TProcedure = z.infer<typeof ProcedureSchema>;
```

### 5.1 `TMetadata`

```typescript
export type TMetadata = {
  title: string;          // min 1
  code: string;           // min 1, unique
  description?: string;   // optional
  category: string;       // min 1
  priority: "basse" | "moyenne" | "haute" | "critique";
  estimatedTimeMinutes: number;  // min 1
  requiredRoles: string[];
  globalSafetyInstructions: string[];
}
```

### 5.2 `TStep`

```typescript
export type TStep = {
  id: string;            // min 1
  title: string;         // min 1
  subtitle?: string;
  instructions: string;  // min 1
  type: "consigne_simple" | "saisie_donnees" | "inspection_visuelle" | "validation_securite" | "mesure_numerique";
  isMandatory: boolean;
  dependencies: string[];
  mediaRequirements: TMediaRequirement[];
  alarms: TAlarmConfig[];
  attachments: string[];
  order: number;         // min 0
  timerEnabled: boolean;
  timerSeconds: number;  // min 0
}
```

### 5.3 `TProcedure`

```typescript
export type TProcedure = {
  metadata: TMetadata;
  steps: TStep[];        // min 1
}
```

### 5.4 Enums/types utilitaires

- **Priorité** : `basse`, `moyenne`, `haute`, `critique` (pas d'enum exportée — c'est un Zod enum)
- **Catégories** : définies dans `src/lib/i18n/procedures.ts:102-109` (pas de type dédié)
- **Rôles** : définis dans `src/lib/i18n/procedures.ts:110-116` (pas de type dédié)
- **StepType** : inline dans `StepTypeSchema` (Zod enum)

---

## 6. ✅ Validateur Zod

**Fichier :** `src/lib/procedures/services/validator.service.ts`

### 6.1 Schémas

| Schéma | Ligne | Champs clés |
|--------|-------|-------------|
| `PrioritySchema` | 3 | enum `basse/moyenne/haute/critique` |
| `StepTypeSchema` | 4-10 | enum 5 types |
| `MediaTypeSchema` | 11 | enum `photo/video/audio/signature` |
| `AlarmTypeSchema` | 12 | enum `DANGER/WARNING/INFO/SECURITY_CHECK` |
| `MediaRequirementSchema` | 14-23 | type, mandatory, options{geolocation, timestamp} |
| `AlarmConfigSchema` | 25-30 | condition (min 1), threshold, type, message (min 1) |
| `StepSchema` | 32-46 | id, title, instructions, type, order, etc. |
| `MetadataSchema` | 48-57 | title, code, category, priority, etc. |
| `ProcedureSchema` | 59-62 | metadata + steps (min 1) |

### 6.2 Fonctions utilitaires

```typescript
export function validateProcedure(data: unknown): TProcedure  // parse + throw
export function validateStep(data: unknown): TStep            // parse + throw
export function hasCircularDependencies(steps: TStep[]): boolean  // DFS cycle detection
export function getCompleteness(steps: TStep[]): number       // 0-100 pourcentage
```

### 6.3 Notes

- `validateProcedure` et `validateStep` lèvent une `ZodError` en cas d'échec
- `hasCircularDependencies` : graphe DFS avec `visited` + `recStack`
- `getCompleteness` : calcule le % d'étapes avec titre + instructions + type renseignés

---

## 7. 🎨 Composants UI shadcn/ui disponibles

**Fichier :** `src/components/ui/` (20 composants)

| Composant | Fichier | Utilisable |
|-----------|---------|------------|
| `avatar.tsx` | ✅ | Oui |
| `badge.tsx` | ✅ | Oui |
| `button.tsx` | ✅ | Oui |
| `card.tsx` | ✅ | Oui |
| `checkbox.tsx` | ✅ | Oui |
| `dialog.tsx` | ✅ | Oui |
| `form.tsx` | ✅ | Oui |
| `input.tsx` | ✅ | Oui |
| `label.tsx` | ✅ | Oui |
| `scroll-area.tsx` | ✅ | Oui |
| `select.tsx` | ✅ | Oui |
| `separator.tsx` | ✅ | Oui |
| `skeleton.tsx` | ✅ | Oui |
| `speech-controls.tsx` | ✅ | Existant — pour la synthèse vocale |
| `switch.tsx` | ✅ | Oui |
| `tabs.tsx` | ✅ | Oui |
| `textarea.tsx` | ✅ | Oui |

### 7.1 Composants **MANQUANTS**

| Composant | Statut | Solution |
|-----------|--------|----------|
| `DropdownMenu` | ❌ Non installé | `npx shadcn@latest add dropdown-menu` |
| `EmptyState` | ❌ N'existe pas | Créer un composant simple |
| `SearchInput` | ❌ N'existe pas | Créer avec `Input` + icône `Search` |

### 7.2 Notes

- `components.json` : style `base-nova`, RSC activé
- Aucune utilisation de `DropdownMenu` dans tout le projet (grep: 0 résultats)
- `sonner` est installé (`package.json:63`) — toast notifications disponibles

---

## 8. 🔍 Recherche / Filtres / Tri existants

**Recherche dans `src/**/*.tsx` :** 0 résultats pour `SearchInput`, `FilterBar`, `SortSelect`, `EmptyState`.

### 8.1 Composants de recherche existants

Aucun composant de recherche dédié. Le seul pattern de recherche est dans `chat-ia/page.tsx` (filtrage de mots-clés dans le chatbot).

### 8.2 Composants de filtres existants

Aucun. Les dashboards existants (`chef-de-bloc`, `chef-de-quart`) n'ont pas de filtres sur leurs listes.

### 8.3 Composants de tri existants

Aucun. Les listes existantes sont soit statiques (`block-procedures.tsx`), soit triées côté serveur (`orderBy: { createdAt: 'desc' }`).

### 8.4 Vue grille / liste

Aucun composant de toggle grille/liste n'existe. Les dashboards utilisent des grilles CSS (`grid grid-cols-1 lg:grid-cols-2`).

---

## 9. 🪝 Hooks personnalisés liés aux procédures

### 9.1 `useProcedureExecution`

**Fichier :** `src/lib/procedures/hooks/useProcedureExecution.ts`

- Hook d'**exécution** (briefing → running → completed/aborted)
- Gère : phase, étapes, timer, médias, anomalies
- **Pas de liste de procédures** — ce hook est pour l'exécution d'une procédure spécifique

### 9.2 `useOfflineSync`

**Fichier :** `src/lib/hooks/useOfflineSync.ts`

- Gère le moteur de sync `SyncEngine` + `IndexedDBAdapter`
- Retourne : `status`, `stats`, `enqueue`, `sync`, `getLocalEntities`, `saveLocalEntity`
- **EntityType** : `'blocks' | 'equipments' | 'groups' | 'groupEquipments' | 'procedures' | 'users' | 'teams'`
- **Utilisation** : dans `sync-status.tsx` (composant de statut sync)
- **Pas de hook dédié `useProcedures`** — les procédures utilisent `localStorage` directement

### 9.3 `useOfflineEntity`

**Fichier :** `src/lib/hooks/useOfflineEntity.ts`

- Générique — wrapper autour de `useOfflineSync` pour un type d'entité
- **Non utilisé** par les procédures (elles utilisent `getProcedures()` / `localStorage` directement)

### 9.4 `usePermissions`

**Fichier :** `src/lib/hooks/usePermissions.ts`

```typescript
export function usePermissions() {
  const { data: session } = useSession();
  const role = PRISMA_ROLE_TO_APP_ROLE[session?.user?.role] || "rondier";
  const permissions = RBAC_MATRIX[role] || [];
  return { role, permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}
```

- **Utilisable** pour masquer/afficher des éléments selon les permissions
- `PermissionGuard` utilise ce hook en interne

---

## 10. 🔐 RBAC — Matrice des permissions

**Fichier :** `src/lib/types/rbac.ts`

### 10.1 Rôles

```typescript
export type Role = "rondier" | "chef-de-bloc" | "chef-de-quart" | "admin";
```

### 10.2 Permissions procédures

```typescript
export type Permission =
  | "procedures:*" | "procedures:view" | "procedures:create" | "procedures:edit" | "procedures:delete"
  | ...;
```

### 10.3 Matrice

| Rôle | Permissions procédures |
|------|----------------------|
| **rondier** | Aucune (pas dans la liste) |
| **chef-de-bloc** | `procedures:view`, `procedures:create`, `procedures:edit` |
| **chef-de-quart** | `procedures:view`, `procedures:create`, `procedures:edit` |
| **admin** | `procedures:*` (implique view/create/edit/delete) |

### 10.4 `PermissionGuard`

**Fichier :** `src/components/shared/permission-guard.tsx`

```typescript
export function PermissionGuard({ children, permissions, fallback = null, mode = "all" })
```

- Props : `children`, `permissions` (Permission \| Permission[]), `fallback?`, `mode?: "all" | "any"`
- Utilise `usePermissions()` en interne

---

## 11. 📦 Dépendances pertinentes

**Fichier :** `package.json`

| Dépendance | Version | Utilisable |
|------------|---------|------------|
| `next` | `14.2.35` | ✅ App Router |
| `react` | `18` | ✅ |
| `typescript` | `5` | ✅ Strict |
| `tailwindcss` | `3.4.1` | ✅ |
| `lucide-react` | `1.27.0` | ✅ Icons disponibles |
| `sonner` | `1.7.0` | ✅ Toasts |
| `zod` | `3.23.0` | ✅ Schémas |
| `prisma` | `7.10.0` | ✅ ORM |
| `@prisma/client` | `7.10.0` | ✅ Client |
| `react-hook-form` | `7.54.0` | ✅ Formulaires |
| `@hookform/resolvers` | `3.9.0` | ✅ Zod resolver |
| `@radix-ui/react-dialog` | (via shadcn) | ✅ |
| `shadcn` | `4.16.0` | ✅ |
| `next-auth` | `4.24.15` | ✅ Auth |
| `winston` | `3.19.0` | ✅ Logger |
| `@dnd-kit/core` | `6.2.0` | ✅ (pas utile ici) |
| `@dnd-kit/sortable` | `8.0.0` | ✅ (pas utile ici) |
| `@dnd-kit/utilities` | `2.0.0` | ✅ (pas utile ici) |

### 11.1 Absents (à installer)

| Package | Pourquoi | Comment |
|---------|----------|---------|
| `@radix-ui/react-dropdown-menu` | Menu d'actions sur les cartes | `npx shadcn@latest add dropdown-menu` |
| `date-fns` | Formatage de dates | ✅ Déjà installé (`package.json:50`) |

---

## 12. 🗂️ Structure des dossiers procédures

### 12.1 `src/components/procedures/`

```
src/components/procedures/
├── ProcedureChecklist.tsx          # Checklist de complétude (reuses dans DynamicProcedureForm)
├── VersionHistoryPanel.tsx          # Dialogue historique des versions
├── execution/
│   ├── AbortedStage.tsx             # Vue interruption
│   ├── BriefingStage.tsx            # Vue briefing
│   ├── CompletedStage.tsx           # Vue terminé
│   ├── PrerequisitesStage.tsx       # Vue prérequis
│   ├── ProcedureExecutor.tsx        # Orchestrateur des phases (nouveau)
│   ├── ProcedureGuide.tsx           # Wrapper UI
│   ├── RunningStage.tsx             # Vue exécution (RunningStage)
│   ├── StepGuide.tsx                # Affichage d'une étape
│   ├── MediaCapture.tsx             # Capture photo/vidéo/audio/signature
│   └── media-capture.tsx            # Ancien (probablement deprecated)
├── forms/
│   ├── DynamicProcedureForm.tsx    # Formulaire de création (principal)
│   ├── MediaCaptureField.tsx        # Configuration captures média
│   ├── MetadataEditor.tsx           # Éditeur métadonnées
│   └── StepEditor.tsx               # Éditeur d'étapes (drag-drop dnd-kit)
├── shared/
│   └── AlarmDisplay.tsx             # Configuration des alertes
└── visualization/
    ├── ProcedureRunner.tsx          # Ancien runner (probablement deprecated — remplacé par ProcedureExecutor)
    └── ProcedureTimeline.tsx        # Mini-plan interactif
```

### 12.2 `src/lib/procedures/`

```
src/lib/procedures/
├── types.ts                         # Types TypeScript (GuidePhase, CapturedMedia, etc.)
├── mock-data.ts                     # Procédures mockées (3 exemples)
├── offline-repo.ts                  # Repository offline (localStorage + mock fallback)
├── server-store.ts                  # Store serveur (.local-db/procedures/)
├── assistants/
│   └── mock-assistant.ts            # Assistant IA (conseils contextuels)
├── hooks/
│   └── useProcedureExecution.ts     # Hook d'exécution
└── services/
    ├── procedure-manager.service.ts # Service client (localStorage + API)
    ├── procedure-version.service.ts # Service versionnage (Prisma Document)
    └── validator.service.ts         # Schémas Zod + utilitaires
```

### 12.3 `src/lib/services/`

```
src/lib/services/
├── procedures.service.ts            # CRUD Prisma (DB)
├── procedures.fallback.ts         # Wrapper avec fallback + circuit breaker
├── guide-procedures.service.ts     # Alternative paginée (potentiellement deprecated)
├── db.ts                          # Connection manager Prisma
└── ...
```

---

## 13. 🚩 Analyse des doublons et conflits

### 13.1 Deux systèmes d'API parallèles

| Système | Routes | Service | Style |
|---------|--------|---------|-------|
| **guide** | `/api/procedures/guide/*` | `procedures.fallback.ts` + `procedure-manager.service.ts` | `safe*` (fallback) |
| **guide-procedures** | `/api/guide-procedures/*` | `guide-procedures.service.ts` | Paginé |

**→ Recommandation :** Utiliser `/api/procedures/guide` uniquement. Ne pas utiliser `/api/guide-procedures`.

### 13.2 Deux runners d'exécution

| Fichier | Description |
|---------|-------------|
| `ProcedureExecutor.tsx` | **Nouveau** — utilise `useProcedureExecution` hook, phases brief/prereq/running/completed/aborted |
| `ProcedureRunner.tsx` | **Ancien** — autonome, utilise `useSpeech`, chat IA intégré |

**→ Recommandation :** `ProcedureExecutor` est le système actif. `ProcedureRunner` est probablement deprecated mais toujours présent.

### 13.3 Stockage multi-niveaux

1. **localStorage** (`nexaflow_procedures`) — cache client principal
2. **.local-db/procedures/procedures.json** — fallback serveur
3. **IndexedDB** (`useOfflineSync`) — système de sync général (non utilisé par les procédures)
4. **PostgreSQL** (Prisma `Procedure` + `Document` tables) — source de vérité

**→ Recommandation :** Pour la page de liste, utiliser `syncFromServer()` (fetch `/api/procedures/guide`) → `getProcedures()`.

---

## 14. 📋 Synthèse finale

### Ce qui existe et peut être réutilisé

| Élément | Fichier | Comment l'utiliser |
|---------|---------|-------------------|
| Page `/guide-procedure` | `page.tsx` | Modifier pour y ajouter la liste |
| `getProcedures()` | `procedure-manager.service.ts:28` | Source de données localStorage |
| `syncFromServer()` | `procedure-manager.service.ts:53` | Sync BDD → localStorage |
| `TProcedure` / `TStep` | `validator.service.ts` | Types pour les props |
| `ProcedureSchema` | `validator.service.ts:59` | Validation |
| `getCompleteness()` | `validator.service.ts:110` | Calculer le % de complétude |
| `hasCircularDependencies()` | `validator.service.ts:78` | Détecter les dépendances circulaires |
| `proceduresFR` (i18n) | `lib/i18n/procedures.ts` | Labels et traductions |
| `usePermissions()` | `lib/hooks/usePermissions.ts` | Contrôle d'accès |
| `PermissionGuard` | `components/shared/permission-guard.tsx` | Protection UI |
| RBAC_MATRIX | `lib/types/rbac.ts` | Permissions |
| `withAuth` | `lib/api/auth-guard.ts` | Protection API |
| shadcn `Card`, `Badge`, `Button`, `Input`, `Select` | `components/ui/` | Structure UI |
| `ProcedureChecklist` | `ProcedureChecklist.tsx` | Adapter pour l'affichage |
| Mock procedures | `mock-data.ts` | Données de test |
| `ProcedureGuide` → `/procedures/guide/{code}` | `procedures/guide/[id]/` | Destination des cartes |

### Ce qui manque et doit être créé

| Élément | Raison |
|---------|--------|
| `ProcedureCard.tsx` | Aucun composant de carte pour les procédures |
| `SearchInput` | Aucun composant de recherche |
| `EmptyState` | Aucun composant d'état vide réutilisable |
| `DropdownMenu` (shadcn) | Non installé — pour le menu d'actions carte |
| Logique de filtrage/tri | Aucune implémentation existante |

### Ce qui est en conflit avec la proposition

| Conflit | Description | Solution |
|---------|-------------|----------|
| Deux APIs (`/guide` vs `/guide-procedures`) | Duplicate endpoints | Utiliser `/api/procedures/guide` |
| `ProcedureRunner` vs `ProcedureExecutor` | Deux runners d'exécution | `ProcedureExecutor` est actif |
| Pas de `DropdownMenu` | Pas installé | `npx shadcn@latest add dropdown-menu` |
| `guide-procedure/page.tsx` ne charge pas au montage | State vide non initialisé | Corriger avec `useEffect` + `getProcedures()` |

### Recommandations d'implémentation (actions concrètes)

1. **Installer `DropdownMenu`** : `npx shadcn@latest add dropdown-menu`

2. **Créer `ProcedureCard.tsx`** dans `src/components/procedures/` :
   - Props : `procedure: TProcedure`, `onExecute?: () => void`
   - Affiche : titre, code, description, catégorie, priorité (badge couleur), durée estimée, rôles, nombre d'étapes, score de complétude
   - Menu d'actions (`DropdownMenu`) : Exécuter, Dupliquer, Supprimer (selon permissions)
   - Click → redirige vers `/procedures/guide/{code}`

3. **Modifier `guide-procedure/page.tsx`** :
   - Ajouter `syncFromServer()` au `useEffect` initial
   - Ajouter un `SearchInput` (filtre par titre, code, catégorie)
   - Ajouter un `Select` pour le tri (date, titre, priorité)
   - Afficher les procédures sous forme de grille de `ProcedureCard`
   - Utiliser `EmptyState` quand la liste est vide

4. **Créer `EmptyState.tsx`** dans `src/components/ui/` ou `src/components/shared/`

5. **Utiliser `getCompleteness()` et `hasCircularDependencies()`** pour les indicateurs visuels sur les cartes
