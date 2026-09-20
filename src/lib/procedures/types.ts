export interface ProcedurePrerequisite {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
}

export type GuidePhase = "briefing" | "prerequisites" | "executing" | "completed" | "aborted";

export interface CapturedMedia {
  id: string;
  stepId: string;
  type: "photo" | "video" | "audio" | "signature";
  dataUrl: string;
  mimeType: string;
  size: number;
  timestamp: number;
  geolocation?: { latitude: number; longitude: number } | null;
  name?: string;
  uploaded?: boolean;
}

export interface AssistantAdvice {
  stepId: string;
  phase: GuidePhase;
  message: string;
  timestamp: number;
}

export interface ProcedureExecutionContext {
  currentStepIndex: number;
  completedSteps: Set<string>;
  startedAt: number;
  finishedAt?: number;
  anomalies: string[];
  capturedMedia: CapturedMedia[];
}
