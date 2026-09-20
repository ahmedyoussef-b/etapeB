"use client";

import { useCallback, useRef, useState } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import { useVoiceCommands } from "@/lib/speech/use-voice-commands";
import { TStep } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";

export interface UseVoiceAssistantOptions {
  language?: string;
  autoRead?: boolean;
  onReadStart?: () => void;
  onReadEnd?: () => void;
  onCommandRecognized?: (command: string) => void;
  voiceCommandHandlers?: {
    onNextStep?: () => void;
    onPreviousStep?: () => void;
    onRepeatStep?: () => void;
    onGetHelp?: () => void;
    onCompleteStep?: () => void;
    onStopAll?: () => void;
    onCaptureMedia?: () => void;
  };
}

export interface UseVoiceAssistantReturn {
  isEnabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isVoiceCommandsEnabled: boolean;
  error: string | null;
  toggleEnabled: () => void;
  toggleVoiceCommands: () => void;
  readStep: (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => void;
  stopReading: () => void;
  readText: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

function buildStepScript(step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase): string {
  const parts: string[] = [];

  if (phase === "briefing") {
    parts.push("Briefing de la procédure.");
    if (step.title) parts.push(`Objectif : ${step.title}.`);
    if (step.instructions) parts.push(step.instructions);
    return parts.join(" ");
  }

  if (phase === "prerequisites") {
    parts.push("Vérifiez les prérequis suivants avant de démarrer.");
    return parts.join(" ");
  }

  parts.push(`Étape ${stepIndex + 1} sur ${totalSteps}.`);
  if (step.title) parts.push(`${step.title}.`);
  if (step.subtitle) parts.push(`${step.subtitle}.`);
  if (step.instructions) parts.push(`Instructions : ${step.instructions}.`);
  if (step.isMandatory) parts.push("Étape obligatoire.");
  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    const secs = step.timerSeconds % 60;
    parts.push(`Chronomètre : ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}.`);
  }
  if (step.mediaRequirements.length > 0) {
    parts.push("Captures requises :");
    step.mediaRequirements.forEach((m) => {
      parts.push(`${m.type}${m.mandatory ? " obligatoire" : ""}.`);
    });
  }
  if (step.alarms.length > 0) {
    parts.push(`${step.alarms.length} alerte(s) configurée(s).`);
    step.alarms.forEach((alarm) => {
      parts.push(`Alerte ${alarm.type} : ${alarm.message}.`);
    });
  }
  return parts.join(" ");
}

export function useVoiceAssistant({
  language = "fr-FR",
  autoRead = true,
  onReadStart,
  onReadEnd,
  onCommandRecognized,
  voiceCommandHandlers = {},
}: UseVoiceAssistantOptions = {}): UseVoiceAssistantReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const { speak, stopSpeaking, isSpeaking, isListening, error, startListening, stopListening, toggleListening } =
    useSpeech({ language, continuous: false });
  const autoReadRef = useRef(autoRead);
  autoReadRef.current = autoRead;

  const voiceCommands = useVoiceCommands(
    {
      onCommandRecognized: (match) => {
        onCommandRecognized?.(match.original);
      },
      ...voiceCommandHandlers,
    },
    { enabled: true, language, autoStop: true }
  );

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const toggleVoiceCommands = useCallback(() => {
    voiceCommands.toggleCommands();
  }, [voiceCommands]);

  const readStep = useCallback(
    (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => {
      if (!isEnabled) return;
      const script = buildStepScript(step, stepIndex, totalSteps, phase);
      onReadStart?.();
      speak(script);
    },
    [isEnabled, speak, onReadStart]
  );

  const readText = useCallback(
    (text: string) => {
      if (!isEnabled) return;
      onReadStart?.();
      speak(text);
    },
    [isEnabled, speak, onReadStart]
  );

  const stopReading = useCallback(() => {
    stopSpeaking();
    onReadEnd?.();
  }, [stopSpeaking, onReadEnd]);

  return {
    isEnabled,
    isSpeaking,
    isListening,
    isVoiceCommandsEnabled: voiceCommands.isCommandsEnabled,
    error: error || null,
    toggleEnabled,
    toggleVoiceCommands,
    readStep,
    stopReading,
    readText,
    startListening: voiceCommands.startListening,
    stopListening: voiceCommands.stopListening,
    toggleListening,
  };
}
