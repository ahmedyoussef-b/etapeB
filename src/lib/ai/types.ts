export interface ChatContext {
  step?: {
    id: string;
    title: string;
    type: string;
    instructions?: string;
    isMandatory: boolean;
    timerEnabled: boolean;
    timerSeconds: number;
    mediaRequirements: Array<{ type: string; mandatory: boolean }>;
    alarms: Array<{ type: string; condition: string; message: string }>;
    dependencies: string[];
  };
  stepIndex?: number;
  totalSteps?: number;
  phase?: string;
  procedureCode?: string;
}

export interface ChatRequest {
  message: string;
  context?: ChatContext;
}

export interface ChatResponse {
  reply: string;
  source: 'groq' | 'mock' | 'tauri-rag';
  model?: string;
  error?: string;
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ChatSource = 'groq' | 'mock' | 'tauri-rag';

export interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: GroqMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}