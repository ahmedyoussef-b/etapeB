/**
 * Voice command mapping for the procedure guide.
 * Normalizes recognized speech and maps it to action handlers.
 */

export type VoiceCommandAction =
  | "next_step"
  | "previous_step"
  | "repeat_step"
  | "get_help"
  | "complete_step"
  | "stop_all"
  | "capture_media";

export interface VoiceCommandMatch {
  action: VoiceCommandAction;
  confidence: "high" | "medium";
  original: string;
}

interface CommandPattern {
  action: VoiceCommandAction;
  patterns: RegExp[];
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // Next step
  {
    action: "next_step",
    patterns: [
      /\b(suivante?|suivant|suivants?|next|next step|next one|continue|continuer|continuation|avancer|avance)\b/i,
    ],
  },
  // Previous step
  {
    action: "previous_step",
    patterns: [
      /\b(précédent|précédente|précédents?|précédentes?|previous|previous step|retour|back|reculer|aller en arrière)\b/i,
    ],
  },
  // Repeat step
  {
    action: "repeat_step",
    patterns: [
      /\b(répète|répéter|répétition|repeat|encore|de nouveau|again|relire|relis|relise)\b/i,
    ],
  },
  // Get help
  {
    action: "get_help",
    patterns: [
      /\b(aide|aider|conseil|conseils|que faire|comment faire|what to do|help)\b/i,
    ],
  },
  // Complete step
  {
    action: "complete_step",
    patterns: [
      /\b(termine|terminé|terminer|terminons|valider|valide|valider|finish|finished|done|ok|okay)\b/i,
    ],
  },
  // Stop all
  {
    action: "stop_all",
    patterns: [
      /\b(stop|arrête|arrêter|stopper|pause|silence|quiet|tais-toi|shut up)\b/i,
    ],
  },
  // Capture media
  {
    action: "capture_media",
    patterns: [
      /\b(média|photo|photos|capture|capturer|capturer|vidéo|vidéos|audio|signature|prendre|prends)\b/i,
    ],
  },
];

/**
 * Normalize a transcript for matching:
 * - lowercase
 * - trim
 * - remove accents
 * - collapse whitespace
 */
export function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Match a transcript against known voice commands.
 * Returns the best match or null.
 */
export function matchVoiceCommand(transcript: string): VoiceCommandMatch | null {
  const normalized = normalizeTranscript(transcript);
  if (!normalized) return null;

  for (const { action, patterns } of COMMAND_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return {
          action,
          confidence: "high",
          original: transcript.trim(),
        };
      }
    }
  }

  return null;
}

/**
 * Get human-readable label for a voice command action.
 */
export function getVoiceCommandLabel(action: VoiceCommandAction): string {
  const labels: Record<VoiceCommandAction, string> = {
    next_step: "Étape suivante",
    previous_step: "Étape précédente",
    repeat_step: "Répéter l'étape",
    get_help: "Conseil IA",
    complete_step: "Marquer comme effectuée",
    stop_all: "Arrêter",
    capture_media: "Capture média",
  };
  return labels[action] || action;
}

/**
 * Get example phrases for a voice command action.
 */
export function getVoiceCommandExamples(action: VoiceCommandAction): string[] {
  const examples: Record<VoiceCommandAction, string[]> = {
    next_step: ["suivant", "next", "étape suivante", "continuer"],
    previous_step: ["précédent", "retour", "étape précédente"],
    repeat_step: ["répète", "encore", "relire"],
    get_help: ["aide", "conseil", "que faire"],
    complete_step: ["termine", "valider", "terminé"],
    stop_all: ["stop", "arrête", "pause"],
    capture_media: ["photo", "capture", "vidéo"],
  };
  return examples[action] || [];
}

/**
 * Get all supported voice commands with examples.
 */
export function getAllVoiceCommands(): { action: VoiceCommandAction; label: string; examples: string[] }[] {
  const actions: VoiceCommandAction[] = [
    "next_step",
    "previous_step",
    "repeat_step",
    "get_help",
    "complete_step",
    "stop_all",
    "capture_media",
  ];
  return actions.map((action) => ({
    action,
    label: getVoiceCommandLabel(action),
    examples: getVoiceCommandExamples(action),
  }));
}