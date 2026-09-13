"use client";

import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";
import { useProcedureExecution } from "@/lib/procedures/hooks/useProcedureExecution";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import { generateAssistantAdvice } from "@/lib/procedures/assistants/mock-assistant";
import { BriefingStage } from "./BriefingStage";
import { PrerequisitesStage } from "./PrerequisitesStage";
import { RunningStage } from "./RunningStage";
import { CompletedStage } from "./CompletedStage";
import { AbortedStage } from "./AbortedStage";

interface ProcedureExecutorProps {
  procedure: TProcedure;
  onClose: () => void;
}

export function ProcedureExecutor({ procedure, onClose }: ProcedureExecutorProps) {
  const procedureId = procedure.metadata.code;
  const procedureCode = procedure.metadata.code;

  const {
    phase,
    currentStep,
    currentStepIndex,
    totalSteps,
    completedSteps,
    context,
    timer,
    actions,
  } = useProcedureExecution({
    procedure,
    procedureId,
    procedureCode,
    onComplete: (ctx) => {
      console.log("Procedure completed", ctx);
    },
    onAbort: (_ctx, reason) => {
      console.log("Procedure aborted:", reason);
    },
  });

  // Voice assistant must be initialized before handlers that use it
  const voiceRef = useRef<ReturnType<typeof useVoiceAssistant> | null>(null);

  const voice = useVoiceAssistant({
    autoRead: true,
    onReadStart: () => {},
    onReadEnd: () => {},
    onCommandRecognized: (command) => {
      toast.success(`Commande reconnue : "${command}"`, { duration: 2000 });
    },
    voiceCommandHandlers: {
      onNextStep: () => actions.nextStep(),
      onPreviousStep: () => actions.previousStep(),
      onRepeatStep: () => {
        if (currentStep) {
          voiceRef.current?.readStep(currentStep, currentStepIndex, totalSteps, phase);
          toast.success("Étape relue", { duration: 1500 });
        }
      },
      onGetHelp: () => {
        const advice = generateAssistantAdvice({
          step: currentStep!,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
        });
        toast.success(advice, { duration: 4000 });
      },
      onCompleteStep: () => {
        if (currentStep) {
          actions.completeStep(currentStep.id);
          toast.success("Étape marquée comme effectuée", { duration: 1500 });
        }
      },
      onStopAll: () => {
        voiceRef.current?.stopReading();
        voiceRef.current?.stopListening();
        toast.success("Arrêt de la lecture et du micro", { duration: 1500 });
      },
      onCaptureMedia: () => {
        const event = new CustomEvent("voice-capture-request", {
          detail: { stepId: currentStep?.id },
        });
        window.dispatchEvent(event);
        toast.success("Ouverture de la capture...", { duration: 1500 });
      },
    },
  });

  voiceRef.current = voice;

  const handleReadAloud = useCallback(() => {
    if (voice.isSpeaking) {
      voice.stopReading();
    } else if (currentStep) {
      voice.readStep(currentStep, currentStepIndex, totalSteps, phase);
    }
  }, [voice, currentStep, currentStepIndex, totalSteps, phase]);

  const handleSendMessage = useCallback(
    (message: string): string => {
      if (!currentStep) return "";
      return generateAssistantAdvice({
        step: currentStep,
        stepIndex: currentStepIndex,
        totalSteps,
        phase,
        userMessage: message,
      });
    },
    [currentStep, currentStepIndex, totalSteps, phase]
  );

  const currentAdvice = useMemo(() => {
    if (!currentStep) return "";
    return generateAssistantAdvice({
      step: currentStep,
      stepIndex: currentStepIndex,
      totalSteps,
      phase,
    });
  }, [currentStep, currentStepIndex, totalSteps, phase]);

  const progress =
    totalSteps > 0 ? Math.round(((currentStepIndex + (phase === "completed" ? 1 : 0)) / totalSteps) * 100) : 0;

  const handlePhaseTransition = useCallback(
    (nextPhase: GuidePhase) => {
      actions.setPhase(nextPhase);
      if (nextPhase === "executing" && currentStep) {
        voice.readStep(currentStep, currentStepIndex, totalSteps, nextPhase);
      }
    },
    [actions, voice, currentStep, currentStepIndex, totalSteps]
  );

  if (phase === "briefing") {
    return (
      <BriefingStage
        procedure={procedure}
        onStart={() => handlePhaseTransition("prerequisites")}
      />
    );
  }

  if (phase === "prerequisites") {
    return (
      <PrerequisitesStage
        procedure={procedure}
        onValidate={() => {
          timer.start();
          handlePhaseTransition("executing");
        }}
      />
    );
  }

  if (phase === "completed") {
    return (
      <CompletedStage
        procedure={procedure}
        context={context}
        onClose={onClose}
      />
    );
  }

  if (phase === "aborted") {
    return (
      <AbortedStage
        procedure={procedure}
        context={context}
        reason={context.anomalies[context.anomalies.length - 1] || "Interruption"}
        onClose={onClose}
      />
    );
  }

  return (
    <RunningStage
      steps={[...procedure.steps].sort((a, b) => a.order - b.order)}
      currentStepIndex={currentStepIndex}
      completedSteps={completedSteps}
      advice={currentAdvice}
      onPrevious={actions.previousStep}
      onNext={actions.nextStep}
      onToggleComplete={actions.completeStep}
      onSendMessage={handleSendMessage}
      isSpeaking={voice.isSpeaking}
      isAutoRead={true}
      onToggleAutoRead={voice.toggleEnabled}
      onReadAloud={handleReadAloud}
      progress={progress}
      procedureId={procedureId}
      procedureCode={procedureCode}
      capturedMedia={context.capturedMedia}
      voiceAssistant={voice}
    />
  );
}