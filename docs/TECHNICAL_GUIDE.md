# NexaFlow — Guide technique

## Stack technique

- **Frontend** : Next.js 14 (App Router), React 18, TypeScript 5
- **UI** : Tailwind CSS 3.4, shadcn/ui (base-nova), Lucide icons
- **Auth** : NextAuth.js v5 (Credentials + JWT)
- **Base de données** : PostgreSQL 15+ avec Prisma 7
- **Sync** : IndexedDB (offline) + Prisma + fichiers locaux
- **Logs** : Winston
- **Tests** : Vitest (unit), Playwright (E2E)

## Structure du projet

```
app/
├── src/
│   ├── app/                  # Routes Next.js App Router
│   │   ├── (dashboard)/      # Routes dashboard groupées
│   │   ├── api/              # API Routes
│   │   └── login/            # Authentification
│   ├── components/           # Composants React
│   │   ├── dashboard/        # Layout dashboard
│   │   ├── sync/             # Composants de sync
│   │   ├── ui/               # shadcn/ui
│   │   └── shared/           # Composants partagés
│   ├── lib/
│   │   ├── auth/             # NextAuth config
│   │   ├── database/         # Adapters (Prisma, Local, IndexedDB)
│   │   ├── hooks/            # React hooks (offline, auth)
│   │   ├── services/         # Services métier
│   │   ├── sync/             # Sync engine + types
│   │   ├── api/              # Auth guard + RBAC
│   │   └── logger.ts         # Winston logger
│   └── types/                # Types TypeScript
├── prisma/                   # Schéma + migrations
├── docs/                     # Documentation
├── e2e/                      # Tests Playwright
├── logs/                     # Fichiers de log
└── .data/                    # Données locales
```

## Authentification

### Configuration

Fichier : `src/lib/auth/options.ts`

- Provider : Credentials (email + mot de passe)
- Hash : bcryptjs
- Session : JWT
- Rôles : ADMIN, CHEF_DE_QUART, CHEF_DE_BLOC, RONDIER

### Middleware

Fichier : `middleware.ts`

- Protège les routes `/dashboard`, `/admin`, `/equipes`, etc.
- Vérifie les permissions via `routePermissions`
- Redirige vers `/login` si non authentifié

## RBAC

Fichier : `src/lib/types/rbac.ts`

Matrice des permissions par rôle :

```typescript
export const RBAC_MATRIX: Record<Role, Permission[]> = {
  ADMIN: ['users:manage', 'settings:*', ...],
  CHEF_DE_QUART: ['equipes:manage', 'iot:control', ...],
  CHEF_DE_BLOC: ['procedures:create', 'rapports:create', ...],
  RONDIER: ['dashboard:view', 'etat-lieux:*', 'chat-ia:*', ...],
};
```

## Synchronisation offline

Voir `docs/OFFLINE_SYNC.md`

## Logs

### Configuration

Fichier : `src/lib/logger.ts`

- Format : JSON pour les fichiers, console colorée en dev
- Rotation : 5 MB max, 5 fichiers
- Niveaux : error, warn, info, debug

### Utilisation

```typescript
import logger from '@/lib/logger';

logger.info('User logged in', { userId: user.id, role: user.role });
logger.warn('Rate limit exceeded', { ip, resetIn });
logger.error('Sync failed', { error: error.message });
```

### Consultation

- Fichiers : `logs/combined.log`, `logs/error.log`
- UI : `/logs` (admin uniquement)

## Tests

### Unitaires (Vitest)

```bash
npm run test
npm run test:coverage
```

### E2E (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
```

### Scripts utiles

```bash
npm run create-admin              # Créer l'admin
npm run db:seed                   # Seed la BDD
npm run db:reset                  # Reset + seed
npm run build:full                # CI gate complet
```

## Déploiement

1. Variables d'environnement : `AUTH_SECRET`, `DATABASE_URL`, `NEXTAUTH_URL`
2. Build : `npm run build`
3. Start : `npm run start`
4. Migrations : `npx prisma migrate deploy`

## Contribution

- French-first UX/UI
- TypeScript strict
- Pas de commentaire inutile dans le code
- Tests obligatoires pour les nouvelles fonctionnalités
