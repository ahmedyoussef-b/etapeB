# NexaFlow - Application de Gestion de Procédures Opérationnelles

## Vue d'ensemble

**NexaFlow** est une application web de gestion de procédures opérationnelles conçue pour les environnements industriels (centrales électriques, production). Elle permet de créer, exécuter et suivre des procédures sécurisées avec un assistant vocal intégré et un système de guidage IA.

---

## Stack Technique

### Frontend
| Technologie | Version | Usage |
|-------------|---------|-------|
| **Next.js** | 14.2.35 | Framework React (App Router) |
| **React** | 18 | Bibliothèque UI |
| **TypeScript** | 5 | Typage statique |
| **Tailwind CSS** | 3.4.1 | Styling utilitaire |
| **shadcn/ui** | 4.16.0 | Composants UI (base-nova) |
| **Lucide React** | 1.27.0 | Icônes |

### Bibliothèques principales
| Package | Fonction |
|---------|----------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag & drop pour réordonner les étapes |
| `@hookform/resolvers` + `react-hook-form` | Gestion des formulaires |
| `zod` | Validation de schémas |
| `sonner` | Notifications toast |
| `@octokit/rest` | Intégration GitHub API |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Utilitaires CSS |
| `@base-ui/react` | Composants UI de base |
| `@hello-pangea/dnd` | Alternative drag & drop |

### Outils de développement
- **ESLint** avec config `next/core-web-vitals`
- **PostCSS** pour Tailwind
- **dotenv** pour les variables d'environnement

---

## Fonctionnalités

### 1. Page d'accueil (Landing Page)
- **Hero Section** : Présentation du produit
- **Features** : Liste des fonctionnalités
- **Stats** : Statistiques d'utilisation
- **Pricing** : Plans tarifaires
- **CTA** : Appel à l'action
- **Navigation** : Barre de navigation responsive

### 2. Système d'authentification
- **Login** : Connexion par email avec détection automatique du rôle
- **Rôles supportés** :
  - `admin` : Accès complet
  - `chef-de-quart` : Chef de quart
  - `chef-de-bloc` : Chef de bloc
  - `rondier` : Opérateur de ronde

### 3. Dashboard (Tableau de bord)
Le dashboard s'adapte selon le rôle de l'utilisateur avec une navigation latérale dynamique.

#### Pages accessibles par rôle :

| Page | Admin | Chef de Quart | Chef de Bloc | Rondier |
|------|:-----:|:-------------:|:------------:|:-------:|
| Tableau de bord | ✅ | ✅ | ✅ | ✅ |
| Pipeline | ✅ | ❌ | ❌ | ❌ |
| Q/R | ✅ | ❌ | ❌ | ❌ |
| Actions IA | ✅ | ❌ | ❌ | ❌ |
| Créer procédure | ✅ | ✅ | ❌ | ❌ |
| Guide procédure | ✅ | ✅ | ✅ | ✅ |
| Structure BDD | ✅ | ❌ | ❌ | ❌ |
| Banque d'images | ✅ | ❌ | ❌ | ❌ |
| Visioconférence | ✅ | ✅ | ✅ | ✅ |
| Rapports | ✅ | ✅ | ❌ | ❌ |
| Équipes | ✅ | ✅ | ❌ | ❌ |
| État des lieux | ✅ | ✅ | ✅ | ✅ |
| Chat IA | ✅ | ✅ | ✅ | ✅ |

### 4. Gestion des Procédures

#### Création de procédures
- **Métadonnées** :
  - Titre, code/référence
  - Description, catégorie (Production, Maintenance, Sécurité, Qualité, Logistique, Environnement)
  - Priorité (Basse, Moyenne, Haute, Critique)
  - Durée estimée, rôles requis
  - Consignes de sécurité globales

- **Étapes de procédure** :
  - Titre, sous-titre, instructions détaillées
  - Type d'étape :
    - Consigne simple
    - Saisie de données
    - Inspection visuelle
    - Validation de sécurité
    - Mesure numérique
  - Étape obligatoire/bloquante
  - Dépendances entre étapes
  - Chronomètre configurable
  - Pièces jointes

- **Captures média** :
  - Photo (avec géolocalisation et horodatage optionnels)
  - Vidéo
  - Audio
  - Signature numérique

- **Alertes et sécurité** :
  - Types : DANGER, WARNING, INFO, SECURITY_CHECK
  - Conditions et seuils configurables
  - Messages d'alerte personnalisés

- **Fonctionnalités** :
  - Drag & drop pour réordonner les étapes
  - Duplication d'étapes
  - Validation en temps réel
  - Indicateur de complétude
  - Sauvegarde en brouillon (localStorage)
  - Export JSON
  - Import JSON

#### Exécution de procédures (Guide IA)
Le guide accompagne l'opérateur étape par étape :

1. **Briefing** : Vue d'ensemble de la procédure
2. **Prérequis** : Checklist de validation avant démarrage
3. **Exécution** :
   - Affichage détaillé de l'étape en cours
   - Navigation entre étapes
   - Marquage des étapes complétées
   - Barre de progression
   - Conseils IA contextuels
   - Chat avec l'assistant IA
4. **Terminé** : Résumé avec durée, étapes complétées, anomalies
5. **Interrompu** : Enregistrement du motif d'interruption

### 5. Assistant Vocal
- **Synthèse vocale** : Lecture automatique des étapes
- **Reconnaissance vocale** : Commandes vocales (Web Speech API)
- **Configuration** : Activation/désactivation, langue (fr-FR)

### 6. Système Embarqué (IoT)
Simulation de connexion à un appareil IoT :
- **Connexion** : USB/Ethernet ou Wi-Fi/Bluetooth
- **Capteurs** :
  - Caméra (1920x1080, 30fps, détection de mouvement)
  - Microphone (niveau audio en temps réel)
  - Température (avec alertes de seuil)
- **Actionneurs** : Relais, Servo, LED, Moteur, Vanne
- **Sortie vocale** : Lecture des résultats et alertes

### 7. Pipeline GitHub
- **Push** : Déploiement vers GitHub
- **Pull** : Récupération depuis GitHub
- **Suivi** : Barre de progression, journal d'exécution
- **Repository** : `ahmedyoussef-b/ccp-etapeB`

### 8. État des Lieux
- Création de rapports avec pièces jointes (images/vidéos)
- Suivi des statuts (brouillon, envoyé)
- Stockage local (système de fichiers `.local-db/`)

### 9. Banque d'Images
- Stockage d'images et vidéos
- Catégorisation et tags
- Métadonnées (taille, type MIME, date)

### 10. Gestion des Équipes
- 4 équipes (A, B, C, D) de 7 membres chacune
- Rôles : Chef de quart, Chef de bloc TG1/TG2, Rondier TV/Post Gaz/TG1/TG2
- Statuts : actif, absent

### 11. Mode Sombre
- Thème clair/sombre avec persistance localStorage
- Détection automatique des préférences système

---

## Architecture de l'application

### Structure des routes

```
/                          → Page d'accueil
/login                     → Connexion
/contact                   → Formulaire de contact
/procedures/guide/[id]     → Guide de procédure

/(dashboard)/
├── /admin                 → Tableau de bord admin
├── /chef-de-quart         → Espace chef de quart
├── /chef-de-bloc          → Espace chef de bloc
├── /rondier               → Espace rondier
├── /pipeline              → Pipeline GitHub
├── /q-r                   → Questions/Réponses
├── /actions-ia            → Actions IA
├── /creer-procedure       → Création de procédure
├── /guide-procedure       → Guide de procédure
├── /structure-bdd         → Structure base de données
├── /images                → Banque d'images
├── /video-conference      → Visioconférence
├── /rapports              → Rapports
├── /equipes               → Gestion des équipes
├── /equipes/[teamId]      → Détail équipe
├── /etat-des-lieux        → État des lieux
├── /chat-ia               → Chat IA
└── /profile               → Profil utilisateur

/api/
├── /etat-des-lieux        → CRUD rapports
│   └── /[id]              → Opérations par ID
├── /images                → CRUD médias
│   └── /[id]              → Opérations par ID
├── /pipeline/
│   ├── /deploy            → Push vers GitHub
│   └── /pull              → Pull depuis GitHub
└── /procedures/guide/[id] → Guide procédure
```

---

## Arborescence complète du projet

```
app/
├── .dist/                          # Fichiers de distribution (vide)
├── .env.local                      # Variables d'environnement (GitHub config)
├── .eslintrc.json                  # Configuration ESLint
├── .git/                           # Dépôt Git
├── .local-db/                      # Base de données locale (fichiers)
│   ├── .local-db-manifest.json     # Manifeste de la BDD locale
│   ├── chroma-index.json           # Index Chroma (vectoriel)
│   ├── etat-des-lieux/             # Rapports d'état des lieux
│   ├── images/                     # Fichiers images stockés
│   ├── INDEX_CHROMA/               # Index vectoriel
│   └── local-db-manifest.json      # Manifeste local
├── .next/                          # Build Next.js (généré)
├── .registry/                      # Registre de composants
│   ├── bank/                       # Registre banque
│   ├── items/                      # Registre éléments
│   └── procedures/                 # Registre procédures
├── components.json                 # Configuration shadcn/ui
├── localetest/                     # Tests locaux (vide)
├── node_modules/                   # Dépendances npm
├── next-env.d.ts                   # Types Next.js
├── next.config.mjs                 # Configuration Next.js
├── package.json                    # Manifeste npm
├── package-lock.json               # Lockfile npm
├── postcss.config.mjs              # Configuration PostCSS
├── README.md                       # Ce fichier
├── scripts/                        # Scripts utilitaires
│   └── check-github-config.js      # Vérification config GitHub
├── src/                            # Code source
│   ├── _gen.js                     # Script de génération
│   ├── _gen_flag                   # Flag de génération
│   ├── .ready                      # Indicateur de prêt
│   ├── app/                        # Routes App Router
│   │   ├── (dashboard)/            # Groupe de routes dashboard
│   │   │   ├── layout.tsx          # Layout dashboard (sidebar + topnav)
│   │   │   ├── actions-ia/         # Page Actions IA
│   │   │   │   └── page.tsx
│   │   │   ├── admin/              # Page Admin
│   │   │   │   └── page.tsx
│   │   │   ├── chat-ia/            # Page Chat IA
│   │   │   │   └── page.tsx
│   │   │   ├── chef-de-bloc/       # Page Chef de bloc
│   │   │   │   └── page.tsx
│   │   │   ├── chef-de-quart/      # Page Chef de quart
│   │   │   │   └── page.tsx
│   │   │   ├── creer-procedure/    # Page Créer procédure
│   │   │   │   └── page.tsx
│   │   │   ├── equipes/            # Page Équipes
│   │   │   │   ├── page.tsx
│   │   │   │   └── [teamId]/       # Détail équipe
│   │   │   │       └── page.tsx
│   │   │   ├── etat-des-lieux/     # Page État des lieux
│   │   │   │   └── page.tsx
│   │   │   ├── guide-procedure/    # Page Guide procédure
│   │   │   │   └── page.tsx
│   │   │   ├── images/             # Page Banque d'images
│   │   │   │   └── page.tsx
│   │   │   ├── pipeline/           # Page Pipeline
│   │   │   │   └── page.tsx
│   │   │   ├── profile/            # Page Profil
│   │   │   │   └── page.tsx
│   │   │   ├── q-r/                # Page Q/R
│   │   │   │   └── page.tsx
│   │   │   ├── rapports/           # Page Rapports
│   │   │   │   └── page.tsx
│   │   │   ├── rondier/            # Page Rondier
│   │   │   │   └── page.tsx
│   │   │   ├── structure-bdd/       # Page Structure BDD
│   │   │   │   └── page.tsx
│   │   │   └── video-conference/   # Page Visioconférence
│   │   │       └── page.tsx
│   │   ├── api/                    # Routes API
│   │   │   ├── etat-des-lieux/     # API État des lieux
│   │   │   │   ├── route.ts        # GET (list), POST (create)
│   │   │   │   └── [id]/           # API par ID
│   │   │   │       └── route.ts    # GET, PUT, DELETE
│   │   │   ├── images/             # API Images
│   │   │   │   ├── route.ts        # GET (list), POST (create)
│   │   │   │   └── [id]/           # API par ID
│   │   │   │       └── route.ts    # GET, PUT, DELETE
│   │   │   ├── pipeline/           # API Pipeline
│   │   │   │   ├── deploy/         # Déploiement
│   │   │   │   │   └── route.ts    # POST (push)
│   │   │   │   └── pull/           # Récupération
│   │   │   │       └── route.ts    # POST (pull)
│   │   │   └── procedures/         # API Procédures
│   │   │       └── guide/          # Guide
│   │   │           ├── route.ts
│   │   │           └── [id]/       # Guide par ID
│   │   │               └── route.ts
│   │   ├── contact/                # Page Contact
│   │   │   └── page.tsx
│   │   ├── favicon.ico             # Icône
│   │   ├── fonts/                  # Polices
│   │   │   ├── GeistMonoVF.woff    # Geist Mono
│   │   │   └── GeistVF.woff        # Geist Sans
│   │   ├── globals.css             # Styles globaux (Tailwind + variables CSS)
│   │   ├── layout.tsx              # Layout racine
│   │   ├── login/                  # Page Login
│   │   │   └── page.tsx
│   │   ├── page.tsx                # Page d'accueil
│   │   └── procedures/             # Routes procédures
│   │       └── guide/              # Guide
│   │           └── [id]/           # Guide par ID
│   │               └── page.tsx
│   ├── components/                 # Composants réutilisables
│   │   ├── brand/                  # Marque
│   │   │   └── nexaflow-logo.tsx   # Logo NexaFlow
│   │   ├── creer-procedure-form.tsx # Formulaire création procédure
│   │   ├── dashboard/              # Dashboard
│   │   │   ├── sidebar.tsx         # Barre latérale (navigation par rôle)
│   │   │   └── top-nav.tsx         # Barre de navigation supérieure
│   │   ├── embedded-system/        # Système embarqué (IoT)
│   │   │   ├── actuator-control.tsx    # Contrôle actionneurs
│   │   │   ├── device-connection.tsx   # Connexion appareil
│   │   │   ├── embedded-system-panel.tsx # Panneau principal
│   │   │   ├── sensor-readings.tsx     # Lectures capteurs
│   │   │   └── voice-output.tsx        # Sortie vocale
│   │   ├── homepage/               # Page d'accueil
│   │   │   ├── cta.tsx             # Call to action
│   │   │   ├── features.tsx        # Fonctionnalités
│   │   │   ├── footer.tsx          # Pied de page
│   │   │   ├── hero.tsx            # Section héro
│   │   │   ├── navbar.tsx          # Barre de navigation
│   │   │   ├── pricing.tsx         # Tarification
│   │   │   └── stats.tsx           # Statistiques
│   │   ├── pipeline/               # Pipeline
│   │   │   ├── DeployButton.tsx    # Bouton déploiement
│   │   │   └── DeployPipeline.tsx  # Pipeline complet (push/pull)
│   │   ├── procedures/             # Procédures
│   │   │   ├── execution/          # Exécution
│   │   │   │   ├── AbortedStage.tsx      # Étape interrompue
│   │   │   │   ├── BriefingStage.tsx     # Briefing
│   │   │   │   ├── CompletedStage.tsx    # Terminé
│   │   │   │   ├── PrerequisitesStage.tsx # Prérequis
│   │   │   │   ├── ProcedureExecutor.tsx  # Orchestrateur d'exécution
│   │   │   │   ├── ProcedureGuide.tsx    # Conteneur guide
│   │   │   │   ├── RunningStage.tsx      # En cours d'exécution
│   │   │   │   └── StepGuide.tsx         # Guide d'étape
│   │   │   ├── forms/              # Formulaires
│   │   │   │   ├── DynamicProcedureForm.tsx  # Formulaire dynamique
│   │   │   │   ├── MediaCaptureField.tsx     # Champ capture média
│   │   │   │   ├── MetadataEditor.tsx        # Éditeur métadonnées
│   │   │   │   └── StepEditor.tsx            # Éditeur d'étape (drag & drop)
│   │   │   ├── shared/             # Composants partagés
│   │   │   │   └── AlarmDisplay.tsx  # Affichage alertes
│   │   │   └── visualization/      # Visualisation
│   │   │       ├── ProcedureRunner.tsx  # Exécuteur de procédure
│   │   │       └── ProcedureTimeline.tsx # Timeline procédure
│   │   ├── theme-provider.tsx      # Fournisseur de thème (clair/sombre)
│   │   └── ui/                     # Composants UI de base (shadcn)
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── skeleton.tsx
│   │       ├── speech-controls.tsx
│   │       ├── switch.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   ├── data/                       # Données statiques
│   │   └── teams.ts                # Configuration des équipes
│   ├── hooks/                      # Hooks personnalisés
│   │   └── use-voice-assistant.ts  # Hook assistant vocal
│   └── lib/                        # Bibliothèques utilitaires
│       ├── etat-des-lieux/         # État des lieux
│       │   ├── mock-service.ts     # Service mock (API)
│       │   └── server-store.ts     # Stockage serveur (filesystem)
│       ├── i18n/                   # Internationalisation
│       │   └── procedures.ts       # Traductions français procédures
│       ├── images/                 # Images
│       │   ├── mock-service.ts     # Service mock (API)
│       │   └── server-store.ts     # Stockage serveur (filesystem)
│       ├── procedures/             # Procédures
│       │   ├── assistants/         # Assistants IA
│       │   │   └── mock-assistant.ts   # Conseiller IA mock
│       │   ├── hooks/              # Hooks procédures
│       │   │   └── useProcedureExecution.ts # Hook d'exécution
│       │   ├── mock-data.ts        # Données de démonstration
│       │   ├── offline-repo.ts     # Repository offline (localStorage)
│       │   ├── services/           # Services
│       │   │   ├── procedure-manager.service.ts # Gestion procédures
│       │   │   └── validator.service.ts         # Validation (Zod)
│       │   └── types.ts            # Types TypeScript
│       ├── speech/                 # Synthèse/Reconnaissance vocale
│       │   └── use-speech.ts       # Hook Web Speech API
│       └── utils.ts                # Utilitaires (cn pour Tailwind)
├── tailwind.config.ts              # Configuration Tailwind
├── tsconfig.json                   # Configuration TypeScript
└── tsconfig.tsbuildinfo            # Info build TypeScript
```

---

## Installation et Démarrage

### Prérequis
- Node.js 18+
- npm, yarn, pnpm ou bun

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/ahmedyoussef-b/etapeB.git

# Installer les dépendances
npm install
# ou
yarn install
```

### Configuration

Créer un fichier `.env.local` à la racine du dossier `app/` :

```env
# GitHub Configuration
GITHUB_TOKEN=ghp_VotreTokenGitHub
GITHUB_OWNER=ahmedyoussef-b
GITHUB_REPO=ccp-etapeB
GITHUB_BRANCH=main

# Next.js Configuration
NEXT_PUBLIC_GITHUB_OWNER=ahmedyoussef-b
NEXT_PUBLIC_GITHUB_REPO=ccp-etapeB
NEXT_PUBLIC_GITHUB_BRANCH=main
```

### Démarrage

```bash
# Mode développement
npm run dev
# ou
yarn dev

# Build production
npm run build

# Démarrage production
npm start

# Linting
npm run run lint
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000)

---

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur de développement |
| `npm run build` | Compile l'application pour la production |
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

## 🧪 Tests

### Exécuter les tests

```bash
# Tous les tests
npm test

# Mode watch
npm run test:watch

# Avec couverture
npm run test:coverage

# Type checking
npm run typecheck
```

### Structure des tests

```
src/
├── lib/
│   ├── database/__tests__/
│   │   ├── adapters.test.ts
│   │   ├── bootstrap.test.ts
│   │   ├── import-normalizer.test.ts
│   │   └── unified-database.service.test.ts
│   └── parsers/__tests__/
│       ├── csv-parser.test.ts
│       ├── xlsx-parser.test.ts
│       └── pdf-parser.test.ts
├── lib/services/sync/__tests__/
│   └── sync.service.test.ts
└── app/api/__tests__/
    ├── upload.test.ts
    ├── sync.test.ts
    └── structure.test.ts
```

### Couverture des tests

| Module | Statut | Tests |
|--------|--------|-------|
| Storage Adapters | ✅ | 10 tests |
| Unified Service | ✅ | 9 tests |
| Bootstrap | ✅ | 5 tests |
| Import Normalizer | ✅ | 5 tests |
| CSV Parser | ✅ | 3 tests |
| Excel Parser | ✅ | 2 tests |
| Sync Service | ✅ | 2 tests |
| API Routes | ⏳ | En cours |

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Guide de Développement](docs/DEVELOPMENT.md)
- [Guide de Déploiement](docs/DEPLOYMENT.md)

## Contact

- **Email** : sales@nexaflow.com
- **Téléphone** : +33 1 23 45 67 89
- **Adresse** : Paris, France

### LocalStorage (Client)
- `nexaflow_procedures` : Procédures créées
- `theme` : Préférence de thème (clair/sombre)
- `dashboardRole` : Rôle actif

### Système de fichiers (Serveur - `.local-db/`)
- `etat-des-lieux/reports.json` : Rapports d'état des lieux
- `images/items.json` : Métadonnées des médias

---

## API Endpoints

### État des Lieux
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/etat-des-lieux` | Liste tous les rapports |
| POST | `/api/etat-des-lieux` | Crée un rapport |
| GET | `/api/etat-des-lieux/[id]` | Récupère un rapport |
| PUT | `/api/etat-des-lieux/[id]` | Met à jour un rapport |
| DELETE | `/api/etat-des-lieux/[id]` | Supprime un rapport |

### Images
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/images` | Liste toutes les images |
| POST | `/api/images` | Ajoute une image |
| GET | `/api/images/[id]` | Récupère une image |
| PUT | `/api/images/[id]` | Met à jour une image |
| DELETE | `/api/images/[id]` | Supprime une image |

### Pipeline
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/pipeline/deploy` | Push vers GitHub |
| POST | `/api/pipeline/pull` | Pull depuis GitHub |

### Procédures
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/procedures/guide` | Liste les guides |
| GET | `/api/procedures/guide/[id]` | Récupère un guide |

---

## Composants UI (shadcn/ui)

L'application utilise les composants shadcn/ui suivants :
- Avatar, Badge, Button, Card, Checkbox, Dialog
- Form, Input, Label, ScrollArea, Select, Separator
- Skeleton, SpeechControls, Switch, Tabs, Textarea

---

## Personnalisation du Thème

Le thème est défini via des variables CSS OKLCH dans `src/app/globals.css` :
- Mode clair (`.root`)
- Mode sombre (`.dark`)

Couleurs personnalisées pour les alarmes :
- `alarm-danger` : Rouge (alertes critiques)
- `alarm-warning` : Orange (avertissements)
- `alarm-info` : Bleu (informations)
- `alarm-security` : Jaune (contrôles sécurité)

---

## Contribution

1. Forker le projet
2. Créer une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commiter les changements (`git commit -m 'Ajout fonctionnalité'`)
4. Pousser la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrir une Pull Request

---

## Licence

Projet privé - Tous droits réservés

---

## Contact

- **Email** : sales@nexaflow.com
- **Téléphone** : +33 1 23 45 67 89
- **Adresse** : Paris, France
