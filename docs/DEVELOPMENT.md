# Guide de Développement

## Prérequis

- Node.js 18+
- PostgreSQL (optionnel, pour Prisma)
- npm ou yarn

## Installation

```bash
# Cloner le repository
git clone <repository-url>
cd app

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env.local

# Initialiser la base de données
npm run db:generate
npm run db:push

# Initialiser les données locales
npm run db:seed
```

## Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Lance le serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarre le serveur de production |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run test` | Lance tous les tests |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:coverage` | Tests avec rapport de couverture |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:generate` | Génère le client Prisma |
| `npm run db:push` | Push du schema vers la DB |
| `npm run db:seed` | Seed des données |
| `npm run build:full` | Typecheck + Tests + Build |

## Structure du Projet

```
src/
├── app/                    # Pages et API routes (Next.js App Router)
│   ├── (dashboard)/        # Pages dashboard avec layout
│   ├── api/                # API routes
│   └── layout.tsx          # Layout racine
├── components/
│   ├── ui/                 # Composants UI réutilisables (shadcn)
│   ├── structure/          # Composants arborescence BDD
│   ├── upload/             # Composants upload fichiers
│   ├── sync/               # Composants synchronisation
│   └── admin/              # Composants administration
├── lib/
│   ├── database/           # Couche données unifiée
│   │   ├── adapters/       # Stockage Local/Web
│   │   ├── services/       # Services métier
│   │   └── __tests__/      # Tests unitaires
│   ├── parsers/            # Parseurs CSV/Excel/PDF
│   ├── services/           # Services applicatifs
│   └── utils.ts            # Utilitaires
├── data/                   # Données statiques
└── hooks/                  # Hooks React personnalisés
```

## Ajouter une Fonctionnalité

1. **Créer le service** dans `src/lib/services/`
2. **Créer l'API route** dans `src/app/api/`
3. **Créer le composant UI** dans `src/components/`
4. **Ajouter les tests** dans `__tests__/`
5. **Documenter** dans `docs/`

## Conventions de Code

- TypeScript strict (`strict: true`)
- Nommage : PascalCase pour les types, camelCase pour les variables
- Imports : alias `@/` pour `src/`
- Tests : Vitest avec `describe`/`it`/`expect`
- Commits : Conventional Commits (`feat:`, `fix:`, `docs:`)
