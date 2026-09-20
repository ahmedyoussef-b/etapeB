# Guide de Déploiement

## Variables d'Environnement

Deux fichiers locaux (tous deux **gitignorés**) :
- `.env` — variables partagées (développement)
- `.env.local` — **remplace** `.env` (développement local, prioritaire)

> En **production**, aucune de ces clés ne vit dans le repo : elles sont définies dans le
> **dashboard Vercel** (*Settings > Environment Variables*, environnement *Production*).
> Le fichier `.env.production` ne contient que les variables non-secrètes (URL, NEXTAUTH_URL).

### Variables requises (tous environnements)

| Variable | Exemple | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...@neon.tech/neondb?sslmode=require` | Connexion Neon (pooled) |
| `DIRECT_URL` | `postgresql://...@neon.tech/neondb?sslmode=require` | Connexion Neon (directe — migrations Prisma) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Secret de chiffrement des JWT NextAuth |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) / `https://etape-b.vercel.app` (prod) | URL de l'application |

### Chat IA (Groq)

| Variable | Valeur | Description |
|---|---|---|
| `USE_GROQ` | `true` | Active le provider Groq |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | ⚠️ Modèle envoyé à l'API Groq |
| `GROQ_API_KEY` | `gsk_...` | Clé API Groq |

> ⚠️ **Correctif modèle Groq (B.3.5bis-3.4)** — CRITIQUE pour la production :
> `GROQ_MODEL` doit être un modèle **accessible** par la clé déployée.
> `llama-3.3-70b-versaile` **n'est pas accessible** par la clé courante → l'API
> renvoie `404 model_not_found` → le chat bascule systématiquement sur le fallback mock.
> **Solution** : utiliser un modèle disponible. Sur la clé courante, listés par
> `GET https://api.groq.com/openai/v1/models`, le plus performant est
> **`openai/gpt-oss-120b`** (120B, réponse multilingue validée). ✅ corrigé localement.
>
> 🔧 **À faire sur Vercel** : mettre à jour la variable **Production** `GROQ_MODEL`
> de `llama-3.3-70b-versaile` → `openai/gpt-oss-120b`. Sans cela, le chat IA est
> cassé en production.

### Services externes

| Variable | Description |
|---|---|
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Upload / banque d'images |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `NEXT_PUBLIC_GITHUB_*` | Pipeline GitHub / sync repo |
| `ABLY_API_KEY`, `NEXT_PUBLIC_ABLY_API_KEY` | WebSocket temps réel (notifications/visio) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Google (référence) |

### Développement uniquement (hors production)

| Variable | Description |
|---|---|
| `OWNER_EMAIL` / `OWNER_PASSWORD` | Comptes de seed admin (ex: `admin@nexaflow.local` / `Admin123!`) |
| `WEAVIATE_URL` / `WEAVIATE_API_KEY` | Vector store (Weaviate) |
| `CHROMA_URL` / `CHROMA_DB_PATH` | Vector store local (Chroma) |
| `BLOB_READ_WRITE_TOKEN` | Stockage blob Vercel (dev) |
| `DATA_PROVIDER` | `neon` |
| `NEXT_PUBLIC_APP_MODE` | `dev` |

## Créer un fichier `.env.local`

Copier `.env.local.example` à la racine, puis remplir les secrets :

```bash
cp .env.local.example .env.local
```

## Déploiement Production

### Vercel (Recommandé)

1. Installer Vercel CLI :
```bash
npm i -g vercel
```
2. Déployer :
```bash
vercel --prod
```
3. **Définir les variables d'environnement** dans le dashboard Vercel
   → *Settings > Environment Variables > Production* → Ajouter chaque variable
   sensible listée ci-dessus (`DATABASE_URL`, `NEXTAUTH_SECRET`, `GROQ_API_KEY`,
   `GROQ_MODEL`, `CLOUDINARY_*`, `ABLY_API_KEY`, `GITHUB_TOKEN`, …).
   > ✅ Vérifier `GROQ_MODEL = openai/gpt-oss-120b` (voir correctif ci-dessus).
4. Un `.env.local.example` est fourni à titre de référence des noms de variables
   (sans secrets) — mais **rien n'est commité** ; les secrets viennent du dashboard.

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

> ⚠️ **Note desktop / Tauri** : le build desktop utilise `npm run build:desktop`
> (`node scripts/build-desktop.js`), **pas** `npm run build`. Voir `B.0.8`.

## Configuration Prisma

```bash
# Générer le client
npm run db:generate

# Appliquer les migrations
npm run db:push

# Seed des données (industriel + utilisateurs par défaut)
npm run db:seed
# → crée admin@nexaflow.local / Admin123! (ADMIN, 12 permissions)
#    + rondier@nexaflow.local / rondier123 (RONDIER)
#    + chef.bloc@nexaflow.local / chef123 (CHEF_DE_BLOC)
#    + chef.quart@nexaflow.local / quart123 (CHEF_DE_QUART)
```

> 🐛 **Bug tooling connu** : `prisma/seed-admin.ts` (script standalone) échoue avec
> `TransformError: esbuild ... "The constant 'Role' must be initialized"` à cause d'une
> incompatibilité esbuild/TSX sur les enums Prisma. Utiliser `npm run db:seed`
> (`prisma/seed.ts`) à la place. → dette v1.1.0 (B.3.5bis-3.6).

## Monitoring

- Logs : Vercel Logs / Docker Logs
- Erreurs : Sentry (à configurer)
- Performance : Next.js Analytics

## Sécurité

- Variables d'environnement protégées (jamais commitées)
- `.env.local` et `.env` sont **gitignorés** (`git check-ignore .env.local` → `ignored`)
- CORS configuré sur les API routes (via `vercel.json` pour Vercel)
- Rate limiting sur les endpoints sensibles
- Validation des inputs avec Zod
- Mot de passe admin en clair `Admin123!` en seed → à migrer vers gestion par invitations (v1.1.0)
