# Guide de Déploiement

## Variables d'Environnement

Créer un fichier `.env.local` à la racine :

```env
# Base de données
DATABASE_URL="postgresql://user:password@host:5432/nexaflow"

# Application
NEXT_PUBLIC_APP_URL="https://nexaflow.app"

# GitHub (pour pipeline)
GITHUB_TOKEN="ghp_..."
GITHUB_OWNER="owner"
GITHUB_REPO="repo"
GITHUB_BRANCH="main"

# Web Database Adapter (optionnel)
WEB_API_URL="https://api.example.com"
WEB_API_KEY="your-api-key"
```

## Déploiement Production

### Vercel (Recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

### Docker

```bash
# Build
docker build -t nexaflow .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  nexaflow
```

### Serveur Node.js

```bash
# Build
npm run build

# Start
npm run start
```

## Configuration Prisma

```bash
# Générer le client
npm run db:generate

# Appliquer les migrations
npm run db:push

# Seed des données
npm run db:seed
```

## Monitoring

- Logs : Vercel Logs / Docker Logs
- Erreurs : Sentry (à configurer)
- Performance : Next.js Analytics

## Sécurité

- Variables d'environnement protégées
- CORS configuré sur les API routes
- Rate limiting sur les endpoints sensibles
- Validation des inputs avec Zod
