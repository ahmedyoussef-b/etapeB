export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-guard';
import { callGroq, getGroqApiKey } from '@/lib/ai/groq-client';
import { buildMessages } from '@/lib/ai/prompts';
import { generateAssistantAdvice } from '@/lib/procedures/assistants/mock-assistant';
import { ChatRequest, ChatResponse } from '@/lib/ai/types';
import logger from '@/lib/logger';

async function handleChat(req: NextRequest, { user }: { user: { id: string; email: string; role: string; name?: string | null } }): Promise<NextResponse> {
  let payload: ChatRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
  }

  const { message, context } = payload;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Le message est requis' }, { status: 400 });
  }

  const apiKey = getGroqApiKey();

  if (apiKey) {
    try {
      logger.info('Appel GROQ', { userId: user.id, procedureCode: context?.procedureCode });

      const messages = buildMessages(message, context);
      const result = await callGroq(messages, apiKey, { model: process.env.GROQ_MODEL });

      logger.info('Réponse GROQ reçue', { userId: user.id, model: result.model });

      const response: ChatResponse = {
        reply: result.content,
        source: 'groq',
        model: result.model,
      };

      return NextResponse.json(response);
    } catch (error) {
      logger.warn('Échec GROQ, fallback vers mock', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn('GROQ_API_KEY manquant, utilisation du mock', { userId: user.id });
  }

  try {
    let mockContext = context;
    if (context?.step) {
      mockContext = {
        ...context,
        step: {
          ...context.step,
          type: context.step.type as any,
          alarms: context.step.alarms as any,
          mediaRequirements: context.step.mediaRequirements as any,
          dependencies: context.step.dependencies,
        },
      };
    }

    const mockReply = generateAssistantAdvice({
      step: mockContext?.step as any,
      stepIndex: mockContext?.stepIndex ?? 0,
      totalSteps: mockContext?.totalSteps ?? 1,
      phase: (mockContext?.phase as any) ?? 'executing',
      userMessage: message,
    });

    const response: ChatResponse = {
      reply: mockReply,
      source: 'mock',
    };

    logger.info('Réponse mock générée', { userId: user.id });
    return NextResponse.json(response);
  } catch (mockError) {
    logger.error('Erreur critique dans le fallback mock', {
      userId: user.id,
      error: mockError instanceof Error ? mockError.message : String(mockError),
    });

    return NextResponse.json(
      {
        reply: 'Une erreur est survenue. Veuillez contacter un superviseur.',
        source: 'mock',
        error: 'internal_error',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handleChat, 'procedures:view');