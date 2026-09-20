"use client";

import { useState, useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/lib/speech/use-speech";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  RotateCcw,
  Send,
  Loader2,
} from "lucide-react";

interface VoiceControlsProps {
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  placeholder?: string;
  language?: string;
  continuous?: boolean;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  showTextInput?: boolean;
  showActions?: boolean;
  sendOnSpeechEnd?: boolean;
  label?: string;
  readOnly?: boolean;
  maxLength?: number;
  multiline?: boolean;
}

export function VoiceControls({
  value,
  onChange,
  onSend,
  placeholder = "Écrivez ou parlez ici...",
  language = "fr-FR",
  continuous = false,
  maxLength,
  disabled = false,
  className,
  textareaClassName,
  showTextInput = true,
  showActions = true,
  sendOnSpeechEnd = false,
  label,
  readOnly = false,
  multiline = true,
}: VoiceControlsProps) {
  const {
    isListening,
    transcript,
    error,
    isSpeaking,
    speak,
    toggleListening,
  } = useSpeech({ language, continuous });

  const [localText, setLocalText] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setLocalText(value);
    }
  }, [value]);

  useEffect(() => {
    if (transcript && onChange) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  useEffect(() => {
    if (sendOnSpeechEnd && transcript && !isListening && onChange) {
      onChange(transcript);
    }
  }, [isListening, transcript, sendOnSpeechEnd, onChange]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (maxLength && val.length > maxLength) return;
      setLocalText(val);
      onChange?.(val);
    },
    [maxLength, onChange]
  );

  const handleSend = useCallback(() => {
    const text = localText.trim();
    if (text) {
      onSend?.(text);
      onChange?.("");
      setLocalText("");
    }
  }, [localText, onSend, onChange]);

  const handleCopy = useCallback(() => {
    const text = localText || transcript;
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, [localText, transcript]);

  const handleReset = useCallback(() => {
    setLocalText("");
    onChange?.("");
  }, [onChange]);

  const handleSpeak = useCallback(() => {
    const text = localText || transcript;
    if (text.trim()) {
      speak(text.trim());
    }
  }, [localText, transcript, speak]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && onSend) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, onSend]
  );

  const isControlled = value !== undefined;
  const displayText = isControlled ? value : localText;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-4 space-y-3">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}

        <div
          className={cn(
            "relative rounded-lg border border-input bg-background transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            error && "border-destructive focus-within:border-destructive",
            textareaClassName
          )}
        >
          <Textarea
            ref={textareaRef}
            value={displayText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || readOnly}
            readOnly={readOnly}
            className={`${multiline ? 'min-h-[80px] resize-none' : 'h-9 resize-none'} border-0 bg-transparent px-3 py-2 text-base focus-visible:ring-0 placeholder:text-muted-foreground`}
            maxLength={maxLength}
          />

          {showActions && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                disabled={disabled || (!displayText && !transcript)}
                className="h-7 w-7"
                title="Copier"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleReset}
                disabled={disabled || (!displayText && !transcript)}
                className="h-7 w-7"
                title="Réinitialiser"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <Loader2 className="h-3 w-3" />
            {error}
          </p>
        )}

        {showActions && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isListening ? "destructive" : "default"}
              size="sm"
              onClick={toggleListening}
              disabled={disabled || readOnly}
              className="gap-1.5"
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Arrêter
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Micro
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSpeak}
              disabled={disabled || (!displayText && !transcript) || isSpeaking || readOnly}
              className="gap-1.5"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  Arrêter
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  Lire
                </>
              )}
            </Button>

            {showTextInput && onSend && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSend}
                disabled={disabled || !displayText.trim()}
                className="gap-1.5 ml-auto"
              >
                <Send className="h-3.5 w-3.5" />
                Envoyer
              </Button>
            )}
          </div>
        )}

        {isListening && transcript && (
          <Badge variant="secondary" className="animate-pulse">
            {transcript}
          </Badge>
        )}
      </div>
    </Card>
  );
}
