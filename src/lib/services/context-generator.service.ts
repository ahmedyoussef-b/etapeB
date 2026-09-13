import fs from 'fs-extra';
import path from 'path';

const CONTEXT_PATH = path.join(process.cwd(), '.dev', 'context.json');

export interface GenerateContextResult {
  success: boolean;
  message: string;
  lastUpdate?: string;
  version?: string;
}

export class ContextGeneratorService {
  async generate(): Promise<GenerateContextResult> {
    try {
      if (!(await fs.pathExists(CONTEXT_PATH))) {
        return {
          success: false,
          message: 'Fichier .dev/context.json introuvable. Créez-le d\'abord via Kilo Code.'
        };
      }

      const context = await fs.readJson(CONTEXT_PATH);
      const now = new Date().toISOString();

      context.lastUpdate = now;
      context.sessionId = `session-${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}-${String(Date.now()).slice(-3)}`;
      context.version = context.version || '3.0.0';

      context.assistantPrompt = {
        header: "## 🤖 PROMPT DE SYNCHRONISATION POUR L'ASSISTANT\n\nCe prompt contient TOUT le contexte du projet NexaFlow.\nIl est généré automatiquement par Kilo Code à la fin de chaque session.\n",
        content: context.assistantPrompt?.content || this.buildAssistantPrompt(context, now),
        generatedAt: now,
        version: context.version
      };

      context.kilocodePrompt = {
        header: "## 🛠️ PROMPT DE SYNCHRONISATION POUR KILO CODE\n\nCe prompt doit être copié dans Kilo Code en début de session.\nIl garantit que Kilo Code comprend son rôle et le contexte.\n",
        content: context.kilocodePrompt?.content || this.buildKilocodePrompt(context, now),
        generatedAt: now,
        version: context.version
      };

      await fs.ensureDir(path.dirname(CONTEXT_PATH));
      await fs.writeJson(CONTEXT_PATH, context, { spaces: 2 });

      return {
        success: true,
        message: 'Contexte généré avec succès',
        lastUpdate: now,
        version: context.version
      };
    } catch (error) {
      return {
        success: false,
        message: `Erreur lors de la génération du contexte : ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private buildAssistantPrompt(context: any, now: string): string {
    const totalRoutes = (context.apiEndpoints?.connected?.length || 0) + (context.apiEndpoints?.pending?.length || 0);
    const lines = [
      "## 🤖 PROMPT DE SYNCHRONISATION POUR L'ASSISTANT",
      `Généré le : ${now}`,
      `Session : ${context.sessionId}`,
      `Version : ${context.version || '3.0.0'}`,
      '',
      '### 📊 RÉSUMÉ EXÉCUTIF',
      `- **Projet** : ${context.project?.name || 'N/A'}`,
      `- **Framework** : ${context.project?.framework || 'N/A'}`,
      `- **Base de données** : ${context.database?.provider || 'N/A'} + ${context.database?.orm || 'N/A'}`,
      `- **UI** : ${context.project?.ui || 'N/A'}`,
      `- **Auth** : ${context.project?.auth || 'N/A'}`,
      `- **Routes connectées** : ${context.apiEndpoints?.connected?.length || 0}/${totalRoutes}`,
      '',
      '### 📋 ÉTAT COMPLET DU PROJET',
      '',
      '#### ✅ Fonctionnalités implémentées',
    ];

    if (context.features?.implemented?.length) {
      context.features.implemented.forEach((f: any) => {
        lines.push(`- **${f.name}** : ${f.status}${f.connected ? ' (Connecté à Prisma)' : ''}`);
        if (f.files?.length) lines.push(`  - Fichiers : ${f.files.join(', ')}`);
        if (f.decisions?.length) lines.push(`  - Décisions : ${f.decisions.join(', ')}`);
      });
    }

    lines.push('');
    if (context.features?.inProgress?.length) {
      lines.push('#### 🚧 Fonctionnalités en cours');
      context.features.inProgress.forEach((f: any) => {
        lines.push(`- **${f.name}** : ${f.status} (${f.completion || 0}%)`);
        lines.push(`  - Prochaine étape : ${f.nextStep || 'À définir'}`);
        if (f.remainingRoutes?.length) lines.push(`  - Routes restantes : ${f.remainingRoutes.join(', ')}`);
      });
      lines.push('');
    }

    if (context.features?.planned?.length) {
      lines.push('#### 📅 Fonctionnalités planifiées');
      context.features.planned.forEach((f: any) => {
        lines.push(`- **${f.name}** : Priorité ${f.priority || 'moyenne'}`);
        if (f.description) lines.push(`  - ${f.description}`);
      });
      lines.push('');
    }

    lines.push('### 🏗️ ARCHITECTURE');
    lines.push('');
    lines.push('#### Structure des dossiers');
    lines.push('```');
    lines.push(JSON.stringify(context.project?.structure || context.structure || {}, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('#### Base de données');
    lines.push(`- **Provider** : ${context.database?.provider || 'N/A'}`);
    lines.push(`- **ORM** : ${context.database?.orm || 'N/A'}`);
    if (context.database?.models?.length) {
      lines.push(`- **Modèles** : ${context.database.models.map((m: any) => m.name || m).join(', ')}`);
    }
    lines.push('');
    lines.push('### 🔌 API ROUTES');
    lines.push('');
    lines.push(`#### ✅ Connectées (${context.apiEndpoints?.connected?.length || 0})`);
    (context.apiEndpoints?.connected || []).forEach((route: any) => {
      lines.push(`- **${route.path}** : ${route.methods?.join(', ') || 'GET, POST, PUT, DELETE'}`);
    });
    lines.push('');
    lines.push(`#### ⏳ En attente (${context.apiEndpoints?.pending?.length || 0})`);
    (context.apiEndpoints?.pending || []).forEach((route: any) => {
      lines.push(`- **${route.path}** : ${route.methods?.join(', ') || 'GET, POST'}`);
    });
    lines.push('');

    if (context.decisions?.length) {
      lines.push('### 📝 DÉCISIONS D\'ARCHITECTURE');
      context.decisions.forEach((d: any) => {
        lines.push(`- **${d.topic}** : ${d.decision}`);
        if (d.rationale) lines.push(`  - Rationale : ${d.rationale}`);
        lines.push(`  - Statut : ${d.status || 'implemented'}`);
      });
      lines.push('');
    }

    if (context.knownIssues?.length) {
      lines.push('### ⚠️ PROBLÈMES CONNUS');
      context.knownIssues.forEach((issue: any) => {
        lines.push(`- **${issue.description}** : Sévérité ${issue.severity || 'moyenne'}`);
        if (issue.workaround) lines.push(`  - Workaround : ${issue.workaround}`);
      });
      lines.push('');
    }

    if (context.technicalDebt?.length) {
      lines.push('### 💰 DETTE TECHNIQUE');
      context.technicalDebt.forEach((td: any) => {
        lines.push(`- **${td.description}** : Priorité ${td.priority || 'moyenne'}`);
        lines.push(`  - Estimation : ${td.estimation || 'À estimer'}`);
      });
      lines.push('');
    }

    if (context.conventions) {
      lines.push('### 📐 CONVENTIONS DE CODE');
      Object.entries(context.conventions).forEach(([key, value]: [string, any]) => {
        lines.push(`- **${key}** : ${value}`);
      });
      lines.push('');
    }

    if (context.tests) {
      lines.push('### 🧪 TESTS');
      lines.push(`- **Unitaires** : ${context.tests.unit?.passing || 0}/${context.tests.unit?.total || 0} passants`);
      lines.push(`- **Intégration** : ${context.tests.integration?.passing || 0}/${context.tests.integration?.total || 0} passants`);
      if (context.tests.failingTests?.length) {
        lines.push(`- **Tests échouants** : ${context.tests.failingTests.join(', ')}`);
      }
      lines.push('');
    }

    if (context.checkpoints?.length) {
      lines.push('### 📍 CHECKPOINTS');
      context.checkpoints.forEach((cp: any) => {
        lines.push(`- **${cp.id}** : ${cp.step} (${cp.status})`);
      });
      lines.push('');
    }

    if (context.currentSession) {
      lines.push('### 🎯 SESSION EN COURS');
      lines.push(`- **Débutée** : ${context.currentSession.startedAt || 'N/A'}`);
      lines.push(`- **Statut** : ${context.currentSession.status || 'en cours'}`);
      lines.push(`- **Étape actuelle** : ${context.currentSession.currentStep || 'À définir'}`);
      lines.push(`- **Prochaine étape** : ${context.currentSession.nextStep || 'À définir'}`);
      if (context.currentSession.blockers?.length) {
        lines.push(`- **Bloqueurs** : ${context.currentSession.blockers.join(', ')}`);
      }
      lines.push('');
    }

    lines.push('### 🔄 PATTERN À SUIVRE');
    lines.push('```typescript');
    lines.push('// service.ts - Service Prisma');
    lines.push("import { getPrismaClient } from '../db'");
    lines.push('');
    lines.push('export async function getAllItems() {');
    lines.push('  const prisma = getPrismaClient()');
    lines.push('  return prisma.item.findMany()');
    lines.push('}');
    lines.push('');
    lines.push('// fallback.ts - Wrapper avec fallback');
    lines.push("import * as localStore from '@/lib/items/local-store'");
    lines.push('');
    lines.push('export async function safeGetAllItems() {');
    lines.push('  try {');
    lines.push('    return await getAllItems()');
    lines.push('  } catch (error) {');
    lines.push("    console.warn('Prisma fallback to local:', error)");
    lines.push('    return localStore.getAll()');
    lines.push('  }');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('### 📋 POUR RÉPONDRE, L\'ASSISTANT DOIT :');
    lines.push('');
    lines.push('1. Utiliser ce prompt comme contexte complet du projet');
    lines.push('2. Proposer des actions en accord avec la stack technique existante');
    lines.push('3. Ne pas proposer de modifications qui contredisent les décisions prises');
    lines.push('4. Se référer à la structure du projet pour chaque suggestion');
    lines.push('5. Identifier les risques de régression');
    lines.push('6. Proposer des prompts précis pour Kilo Code');
    lines.push('7. Vérifier que chaque suggestion respecte le pattern fallback établi');
    lines.push('');
    lines.push('---');
    lines.push('**🔴 IMPORTANT** : Ce prompt contient TOUT le contexte du projet.');
    lines.push('Une nouvelle session peut commencer avec ce prompt.');

    return lines.join('\n');
  }

  private buildKilocodePrompt(context: any, now: string): string {
    const lines = [
      '## 🛠️ PROMPT DE SYNCHRONISATION POUR KILO CODE',
      `Généré le : ${now}`,
      `Session : ${context.sessionId}`,
      '',
      '### 📋 RÔLE DE KILO CODE',
      'Kilo Code est l\'exécutant principal du projet NexaFlow. Il doit :',
      '1. Lire le fichier `.dev/context.json` en début de session',
      '2. Comprendre l\'état actuel du projet et les prochaines étapes',
      '3. Exécuter les tâches demandées en suivant les conventions',
      '4. Mettre à jour le contexte après chaque action',
      '5. Générer le nouveau prompt pour l\'assistant',
      '',
      '### 🎯 OBJECTIF DE LA SESSION EN COURS',
      'Connecter les API routes restantes à Prisma avec fallback local :'
    ];

    (context.apiEndpoints?.pending || []).forEach((route: any, index: number) => {
      lines.push(`${index + 1}. \`${route.path}\``);
    });

    lines.push('');
    lines.push('### 📁 STRUCTURE ATTENDUE POUR CHAQUE ROUTE');
    lines.push('Pour CHAQUE route à connecter, créer :');
    lines.push('1. `src/lib/services/[nom].service.ts` - Service Prisma');
    lines.push('2. `src/lib/services/[nom].fallback.ts` - Wrapper avec fallback local');
    lines.push('3. Mettre à jour `src/app/api/[nom]/route.ts` pour utiliser le fallback');
    lines.push('');
    lines.push('### 🔄 PATTERN À SUIVRE');
    lines.push('```typescript');
    lines.push('// service.ts');
    lines.push("import { getPrismaClient } from './db';");
    lines.push('');
    lines.push('export async function getAllItems() {');
    lines.push('  const prisma = getPrismaClient();');
    lines.push('  return prisma.item.findMany();');
    lines.push('}');
    lines.push('');
    lines.push('// fallback.ts');
    lines.push("import * as localStore from '@/lib/[nom]/server-store';");
    lines.push('');
    lines.push('export async function safeGetAllItems() {');
    lines.push('  try {');
    lines.push('    return await getAllItems();');
    lines.push('  } catch (error) {');
    lines.push("    console.warn('Prisma unavailable, falling back to local storage:', error);");
    lines.push('    return localStore.getAll();');
    lines.push('  }');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('### ⚠️ RÈGLES STRICTES');
    lines.push('- ✅ Suivre le pattern existant dans `etat-des-lieux` et `images`');
    lines.push('- ✅ Utiliser `getPrismaClient()` depuis `src/lib/services/db.ts`');
    lines.push('- ✅ Gestion d\'erreurs avec try/catch et fallback');
    lines.push('- ✅ Types TypeScript cohérents');
    lines.push('- ❌ Ne pas casser les routes existantes');
    lines.push('- ❌ Ne pas modifier le schéma Prisma sans validation');
    lines.push('- ❌ Ne pas toucher à `src/lib/database/prisma-adapter.ts`');

    if (context.conventions) {
      Object.entries(context.conventions).forEach(([key, value]: [string, any]) => {
        lines.push(`- ❌ Ne pas violer la convention ${key} : ${value}`);
      });
    }

    lines.push('');
    lines.push('### 📊 SUIVI DE PROGRESSION');
    lines.push('| Route | Statut |');
    lines.push('|-------|--------|');
    (context.apiEndpoints?.connected || []).forEach((route: any) => {
      lines.push(`| ${route.path} | ✅ Connecté |`);
    });
    (context.apiEndpoints?.pending || []).forEach((route: any) => {
      lines.push(`| ${route.path} | ⏳ À faire |`);
    });
    lines.push('');
    lines.push('### 📝 MISE À JOUR DU CONTEXTE');
    lines.push('Après chaque route connectée, mettre à jour :');
    lines.push('- `.dev/context.json` : ajouter un checkpoint, mettre à jour `lastUpdate`');
    lines.push('- `assistantPrompt.content` : refléter le nouvel état');
    lines.push('- `kilocodePrompt.content` : mettre à jour la progression');
    lines.push('');
    lines.push('### 🔴 POINTS D\'ATTENTION');
    (context.knownIssues || []).forEach((issue: any) => {
      lines.push(`- ⚠️ ${issue.description} (${issue.severity || 'moyenne'})`);
    });
    lines.push('');

    if (context.technicalDebt?.length) {
      lines.push('### 💰 DETTE TECHNIQUE');
      context.technicalDebt.forEach((td: any) => {
        lines.push(`- **${td.description}** : Priorité ${td.priority || 'moyenne'}`);
        lines.push(`  - Estimation : ${td.estimation || 'À estimer'}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}
