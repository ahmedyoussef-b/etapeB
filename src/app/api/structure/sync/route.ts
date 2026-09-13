// src/app/api/structure/sync/route.ts
// Synchronisation `.data/` → BDD Prisma avec suivi de progression (SSE)
import { NextRequest } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthenticatedResponse, unauthorizedResponse } from '@/lib/api/auth-guard';
import { getPrismaClient } from '@/lib/services/db';
import { syncFromRepertoire } from '../../../../../prisma/seed-from-repertoire';

interface SyncStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
  detail?: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'settings:*')) {
    return unauthorizedResponse();
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const steps: SyncStep[] = [
        { id: 'init', label: 'Initialisation', status: 'in_progress' },
        { id: 'blocks', label: 'Synchronisation des blocs', status: 'pending' },
        { id: 'groups', label: 'Synchronisation des groupes', status: 'pending' },
        { id: 'documents', label: 'Synchronisation des documents', status: 'pending' },
        { id: 'mirror', label: 'Mise à jour du mirror repertoire', status: 'pending' },
        { id: 'indexes', label: 'Mise à jour des indexes', status: 'pending' },
        { id: 'registry', label: 'Synchronisation du registry', status: 'pending' },
        { id: 'rh', label: 'Synchronisation des ressources humaines', status: 'pending' },
        { id: 'data', label: 'Synchronisation des données', status: 'pending' },
        { id: 'final', label: 'Finalisation', status: 'pending' },
      ];

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const updateStep = (id: string, status: SyncStep['status'], detail?: string) => {
        const step = steps.find(s => s.id === id);
        if (step) {
          step.status = status;
          if (detail) step.detail = detail;
          send({ type: 'step', steps: steps.map(s => ({ id: s.id, label: s.label, status: s.status, detail: s.detail })) });
        }
      };

      const prisma = getPrismaClient();

        try {
          updateStep('init', 'done', 'Prisma connecté');

          // Patch syncFromRepertoire to report progress via console (we capture logs)
          // Since syncFromRepertoire is a single function, we wrap it
          updateStep('blocks', 'in_progress');
          updateStep('groups', 'in_progress');
          updateStep('documents', 'in_progress');
          updateStep('mirror', 'in_progress');
          updateStep('indexes', 'in_progress');
          updateStep('registry', 'in_progress');
          updateStep('rh', 'in_progress');
          updateStep('data', 'in_progress');

          await syncFromRepertoire(prisma);

          const stepsToMark = ['blocks', 'groups', 'documents', 'mirror', 'indexes', 'registry', 'rh', 'data'];
          for (const id of stepsToMark) {
            updateStep(id, 'done');
          }

          updateStep('final', 'in_progress');

          const stats = {
            blocks: await prisma.block.count(),
            equipment: await prisma.equipment.count(),
            groups: await prisma.group.count(),
            groupEquipments: await prisma.groupEquipment.count(),
            documents: await prisma.document.count(),
            users: await prisma.user.count(),
            procedures: await prisma.procedure.count(),
            humanResources: await prisma.humanResource.count(),
            teams: await prisma.team.count()
          };

          updateStep('final', 'done', JSON.stringify(stats));
          send({ type: 'done', success: true, stats });
        } catch (error) {
          const stepsInError = steps.filter(s => s.status === 'in_progress');
          for (const s of stepsInError) {
            updateStep(s.id, 'error', error instanceof Error ? error.message : String(error));
          }
          send({ type: 'done', success: false, error: error instanceof Error ? error.message : String(error) });
        } finally {
          controller.close();
        }
      }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
    },
  });
}