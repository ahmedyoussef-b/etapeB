"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./use-speech";
import {
  matchVoiceCommand,
  normalizeTranscript,
  VoiceCommandAction,
  VoiceCommandMatch,
} from "./voice-commands";

export interface VoiceCommandHandlers {
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onRepeatStep?: () => void;
  onGetHelp?: () => void;
  onCompleteStep?: () => void;
  onStopAll?: () => void;
  onCaptureMedia?: () => void;
  onCommandRecognized?: (match: VoiceCommandMatch) => void;
  onUnknownCommand?: (transcript: string) => void;
}

export interface UseVoiceCommandsOptions {
  enabled?: boolean;
  language?: string;
  continuous?: boolean;
  autoStop?: boolean; // Arrêter la reconnaissance après une commande reconnue
}

export interface UseVoiceCommandsReturn {
  isListening: boolean;
  isCommandsEnabled: boolean;
  transcript: string;
  lastMatch: VoiceCommandMatch | null;
  toggleCommands: () => void;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

/**
 * Hook de commandes vocales pour le guide procédure.
 * Écoute le micro, matche les commandes et appelle les callbacks.
 */
export function useVoiceCommands(
  handlers: VoiceCommandHandlers,
  options: UseVoiceCommandsOptions = {}
): UseVoiceCommandsReturn {
  const {
    enabled = true,
    language = "fr-FR",
    continuous = false,
    autoStop = true,
  } = options;

  const [isCommandsEnabled, setIsCommandsEnabled] = useState(enabled);
  const [lastMatch, setLastMatch] = useState<VoiceCommandMatch | null>(null);

  const {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  } = useSpeech({ language, continuous, interimResults: true });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const autoStopRef = useRef(autoStop);
  autoStopRef.current = autoStop;

  const lastMatchRef = useRef<VoiceCommandMatch | null>(null);

  const processTranscript = useCallback((text: string) => {
    if (!text || !text.trim()) return;

    const match = matchVoiceCommand(text);
    if (match) {
      lastMatchRef.current = match;
      setLastMatch(match);

      // Appeler le callback de feedback
      handlersRef.current.onCommandRecognized?.(match);

      // Exécuter l'action correspondante
      switch (match.action) {
        case "next_step":
          handlersRef.current.onNextStep?.();
          break;
        case "previous_step":
          handlersRef.current.onPreviousStep?.();
          break;
        case "repeat_step":
          handlersRef.current.onRepeatStep?.();
          break;
        case "get_help":
          handlersRef.current.onGetHelp?.();
          break;
        case "complete_step":
          handlersRef.current.onCompleteStep?.();
          break;
        case "stop_all":
          handlersRef.current.onStopAll?.();
          break;
        case "capture_media":
          handlersRef.current.onCaptureMedia?.();
          break;
      }

      // Arrêter la reconnaissance après une commande reconnue (si autoStop)
      if (autoStopRef.current && isListening) {
        stopListening();
      }
    } else {
      // Commande non reconnue — notification silencieuse
      handlersRef.current.onUnknownCommand?.(text);
    }
  }, [isListening, stopListening]);

  // Traiter les transcriptions finals
  useEffect(() => {
    if (!transcript) return;
    processTranscript(transcript);
  }, [transcript, processTranscript]);

  const toggleCommands = useCallback(() => {
    setIsCommandsEnabled((prev) => {
      const next = !prev;
      if (!next && isListening) {
        stopListening();
      }
      return next;
    });
  }, [isListening, stopListening]);

  const startListeningHandler = useCallback(() => {
    if (isCommandsEnabled) {
      startListening();
    }
  }, [isCommandsEnabled, startListening]);

  const stopListeningHandler = useCallback(() => {
    stopListening();
  }, [stopListening]);

  const clearTranscript = useCallback(() => {
    // Reset via re-mount du speech hook (on ne peut pas effacer directement)
    lastMatchRef.current = null;
    setLastMatch(null);
  }, []);

  return {
    isListening,
    isCommandsEnabled,
    transcript,
    lastMatch,
    toggleCommands,
    startListening: startListeningHandler,
    stopListening: stopListeningHandler,
    clearTranscript,
  };
}