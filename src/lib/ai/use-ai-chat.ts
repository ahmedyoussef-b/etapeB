"use client";

import { useState, useCallback, useRef } from "react";
import { ChatContext, ChatResponse } from "./types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  source?: "groq" | "mock";
}

export interface UseAiChatOptions {
  initialMessages?: ChatMessage[];
  context?: ChatContext;
  onFallback?: (reason: string) => void;
}

export function useAiChat(options?: UseAiChatOptions) {
  const { initialMessages = [], context, onFallback } = options || {};
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<"groq" | "mock" | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: ChatResponse = await response.json();

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
          source: data.source,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setLastSource(data.source);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const reason = err instanceof Error ? err.message : "Erreur inconnue";
        console.warn("useAiChat: API error, using fallback", reason);
        onFallback?.(reason);

        try {
          const fallbackResponse = await fetch("/api/ai/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: trimmed,
              context,
            }),
          });

          if (fallbackResponse.ok) {
            const data: ChatResponse = await fallbackResponse.json();
            const assistantMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.reply,
              timestamp: new Date(),
              source: data.source,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setLastSource(data.source);
          } else {
            throw new Error("Fallback also failed");
          }
        } catch {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "Une erreur est survenue. Veuillez réessayer ou contacter un superviseur.",
            timestamp: new Date(),
            source: "mock",
          };
          setMessages((prev) => [...prev, errorMessage]);
          setLastSource("mock");
          setError("Erreur de communication avec le serveur");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [context, onFallback]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setLastSource(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearHistory,
    source: lastSource,
  };
}