import { ChatContext } from './types';

export const SYSTEM_PROMPT = `Tu es un expert technique senior qui guide un technicien sur le terrain dans une centrale électrique.
Réponds de manière concise et technique en français.
Si la question nécessite un développement, tu peux dépasser 3 phrases pour fournir une réponse complète.
Utilise un ton professionnel et rassurant.
Si la question dépasse ton domaine, recommande de contacter un superviseur.`;

export function buildContextString(context?: ChatContext): string {
  if (!context) return '';

  const parts: string[] = [];

  if (context.procedureCode) {
    parts.push(`Procédure : ${context.procedureCode}`);
  }

  if (context.step) {
    parts.push(`Étape ${context.stepIndex !== undefined ? context.stepIndex + 1 : '?'} : ${context.step.title}`);
    parts.push(`Type : ${context.step.type}`);
    if (context.step.instructions) {
      parts.push(`Consignes : ${context.step.instructions}`);
    }
    if (context.step.isMandatory) {
      parts.push('⚠️ Étape obligatoire');
    }
    if (context.step.timerEnabled && context.step.timerSeconds > 0) {
      const mins = Math.floor(context.step.timerSeconds / 60);
      parts.push(`⏱️ Chrono : ${mins} min max`);
    }
    if (context.step.mediaRequirements.length > 0) {
      const media = context.step.mediaRequirements
        .map((m: { type: string; mandatory: boolean }) => `${m.type}${m.mandatory ? ' (obligatoire)' : ''}`)
        .join(', ');
      parts.push(`📸 Média requis : ${media}`);
    }
    if (context.step.alarms.length > 0) {
      const alarms = context.step.alarms
        .map((a: { type: string; message: string }) => `[${a.type}] ${a.message}`)
        .join('; ');
      parts.push(`🚨 Alertes : ${alarms}`);
    }
  }

  if (context.phase) {
    parts.push(`Phase : ${context.phase}`);
  }

  if (context.totalSteps && context.stepIndex !== undefined) {
    parts.push(`Progression : ${context.stepIndex + 1}/${context.totalSteps}`);
  }

  return parts.length > 0 ? `\n\nCONTEXTE ACTUEL :\n${parts.join('\n')}` : '';
}

export function buildMessages(userMessage: string, context?: ChatContext): Array<{ role: 'system' | 'user'; content: string }> {
  const contextStr = buildContextString(context);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${userMessage}${contextStr}` },
  ];
}