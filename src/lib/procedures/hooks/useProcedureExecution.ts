"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TProcedure, TStep } from "../services/validator.service";
import { GuidePhase, ProcedureExecutionContext, CapturedMedia } from "../types";

export interface UseProcedureExecutionOptions {
  procedure: TProcedure;
  onComplete?: (context: ProcedureExecutionContext) => void;
  onAbort?: (context: ProcedureExecutionContext, reason: string) => void;
  procedureId?: string;
  procedureCode?: string;
}

export interface UseProcedureExecutionReturn {
  phase: GuidePhase;
  currentStep: TStep | null;
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: Set<string>;
  context: ProcedureExecutionContext;
  timer: {
    stepRemaining: number;
    globalElapsed: number;
    isRunning: boolean;
    isPaused: boolean;
    start: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    reset: () => void;
  };
  actions: {
    goToStep: (index: number) => void;
    nextStep: () => void;
    previousStep: () => void;
    completeStep: (stepId: string) => void;
    setPhase: (phase: GuidePhase) => void;
    abort: (reason: string) => void;
    reset: () => void;
    addCapturedMedia: (media: Omit<CapturedMedia, "id">) => void;
    removeCapturedMedia: (mediaId: string) => void;
  };
}

function createInitialContext(): ProcedureExecutionContext {
  return {
    currentStepIndex: 0,
    completedSteps: new Set<string>(),
    startedAt: Date.now(),
    anomalies: [],
    capturedMedia: [],
  };
}

interface MediaUploadResponse {
  success: boolean;
  media?: {
    id: string;
  };
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "API error");
  }
  return data;
}

export function useProcedureExecution({
  procedure,
  onComplete,
  onAbort,
  procedureId,
  procedureCode,
}: UseProcedureExecutionOptions): UseProcedureExecutionReturn {
  const [phase, setPhase] = useState<GuidePhase>("briefing");
  const [context, setContext] = useState<ProcedureExecutionContext>(() =>
    createInitialContext(),
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [stepRemaining, setStepRemaining] = useState(0);
  const [globalElapsed, setGlobalElapsed] = useState(0);

  const timerIntervalRef = useRef<number | null>(null);
  const currentStepRef = useRef<TStep | null>(null);

  const sortedSteps = useRef<TStep[]>([...procedure.steps].sort((a, b) => a.order - b.order));

  useEffect(() => {
    sortedSteps.current = [...procedure.steps].sort((a, b) => a.order - b.order);
  }, [procedure.steps]);

  const storageKey = `proc_media_${procedureCode || procedure.metadata.code}`;
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(context.capturedMedia));
    } catch (e) {
      console.warn("[useProcedureExecution] Failed to persist media to localStorage:", e);
    }
  }, [context.capturedMedia, storageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContext((ctx) => ({ ...ctx, capturedMedia: parsed }));
        }
      }
    } catch (e) {
      console.warn("[useProcedureExecution] Failed to restore media from localStorage:", e);
    }
  }, [storageKey]);

  const currentStep = sortedSteps.current[context.currentStepIndex] || null;
  currentStepRef.current = currentStep;

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (isTimerRunning && !isTimerPaused && currentStep?.timerEnabled && currentStep.timerSeconds > 0) {
      setStepRemaining(currentStep.timerSeconds);
      timerIntervalRef.current = window.setInterval(() => {
        setStepRemaining((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsTimerRunning(false);
            setContext((ctx) => ({
              ...ctx,
              anomalies: [...ctx.anomalies, `Temps écoulé pour l'étape: ${currentStep.title}`],
            }));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [isTimerRunning, isTimerPaused, currentStep, clearTimer]);

  useEffect(() => {
    let globalInterval: number | null = null;
    if (isTimerRunning && !isTimerPaused) {
      globalInterval = window.setInterval(() => {
        setGlobalElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (globalInterval) clearInterval(globalInterval);
    };
  }, [isTimerRunning, isTimerPaused]);

  const startTimer = useCallback(() => {
    setIsTimerRunning(true);
    setIsTimerPaused(false);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsTimerPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    setIsTimerPaused(false);
  }, []);

  const stopTimer = useCallback(() => {
    clearTimer();
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setStepRemaining(0);
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    clearTimer();
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setStepRemaining(0);
    setGlobalElapsed(0);
  }, [clearTimer]);

  const contextRef = useRef(context);
  contextRef.current = context;

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < sortedSteps.current.length) {
        stopTimer();
        setContext((ctx) => ({ ...ctx, currentStepIndex: index }));
        setPhase("executing");
      }
    },
    [stopTimer],
  );

  const saveCapturedMedia = useCallback(async () => {
    if (!procedureId || !procedureCode) {
      console.warn("[useProcedureExecution] Cannot save media: missing procedureId or procedureCode");
      return;
    }

    const currentContext = contextRef.current;
    const mediaToUpload = currentContext.capturedMedia.filter((m) => !m.uploaded);

    for (const media of mediaToUpload) {
      try {
        const step = sortedSteps.current.find((s) => s.id === media.stepId);
        const stepOrder = step?.order ?? 0;

        const base64Index = media.dataUrl.indexOf(",");
        const base64Data = base64Index >= 0 ? media.dataUrl.slice(base64Index + 1) : media.dataUrl;

        const result = await apiCall<MediaUploadResponse>("/api/procedures/execution/media", {
          method: "POST",
          body: JSON.stringify({
            procedureId,
            procedureCode,
            stepId: media.stepId,
            stepOrder,
            media: {
              name: media.name || `${media.type}_${Date.now()}`,
              base64: base64Data,
              mimeType: media.mimeType,
              type: media.type,
              geolocation: media.geolocation,
              timestamp: media.timestamp,
              uploadedBy: "user",
              metadata: { capturedAt: media.timestamp },
            },
          }),
        });

        if (result.success && result.media) {
          const savedMedia = result.media;
          setContext((ctx) => ({
            ...ctx,
            capturedMedia: ctx.capturedMedia.map((m) =>
              m.id === media.id ? { ...m, uploaded: true, _savedId: savedMedia.id } : m,
            ),
          }));
        }
      } catch (error) {
        console.error("[useProcedureExecution] Error uploading media:", error);
      }
    }
  }, [procedureId, procedureCode]);

  const nextStep = useCallback(async () => {
    const current = contextRef.current;
    if (current.currentStepIndex < sortedSteps.current.length - 1) {
      stopTimer();
      setContext((ctx) => ({
        ...ctx,
        currentStepIndex: ctx.currentStepIndex + 1,
        completedSteps: new Set(ctx.completedSteps).add(
          sortedSteps.current[ctx.currentStepIndex].id,
        ),
      }));
    } else {
      setPhase("completed");
      stopTimer();
      await saveCapturedMedia();
      onComplete?.(contextRef.current);
    }
  }, [stopTimer, onComplete, saveCapturedMedia]);

  const previousStep = useCallback(() => {
    const current = contextRef.current;
    if (current.currentStepIndex > 0) {
      stopTimer();
      setContext((ctx) => ({ ...ctx, currentStepIndex: ctx.currentStepIndex - 1 }));
    }
  }, [stopTimer]);

  const completeStep = useCallback(
    (stepId: string) => {
      setContext((ctx) => {
        const next = new Set(ctx.completedSteps);
        if (next.has(stepId)) {
          next.delete(stepId);
        } else {
          next.add(stepId);
        }
        return { ...ctx, completedSteps: next };
      });
    },
    [],
  );

  const abort = useCallback(
    (reason: string) => {
      const current = contextRef.current;
      stopTimer();
      setContext((ctx) => ({
        ...ctx,
        finishedAt: Date.now(),
        anomalies: [...ctx.anomalies, reason],
      }));
      setPhase("aborted");
      onAbort?.(current, reason);
    },
    [stopTimer, onAbort],
  );

  const reset = useCallback(() => {
    stopTimer();
    setContext(createInitialContext());
    setPhase("briefing");
    setGlobalElapsed(0);
  }, [stopTimer]);

  const addCapturedMedia = useCallback(
    (media: Omit<CapturedMedia, "id">) => {
      const item: CapturedMedia = {
        ...media,
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      setContext((ctx) => ({
        ...ctx,
        capturedMedia: [...ctx.capturedMedia, item],
      }));
    },
    [],
  );

  const removeCapturedMedia = useCallback((mediaId: string) => {
    setContext((ctx) => ({
      ...ctx,
      capturedMedia: ctx.capturedMedia.filter((m) => m.id !== mediaId),
    }));
  }, []);

  return {
    phase,
    currentStep,
    currentStepIndex: context.currentStepIndex,
    totalSteps: sortedSteps.current.length,
    completedSteps: context.completedSteps,
    context,
    timer: {
      stepRemaining,
      globalElapsed,
      isRunning: isTimerRunning,
      isPaused: isTimerPaused,
      start: startTimer,
      pause: pauseTimer,
      resume: resumeTimer,
      stop: stopTimer,
      reset: resetTimer,
    },
    actions: {
      goToStep,
      nextStep,
      previousStep,
      completeStep,
      setPhase,
      abort,
      reset,
      addCapturedMedia,
      removeCapturedMedia,
    },
  };
}