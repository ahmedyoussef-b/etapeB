"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { useSpeech } from "@/lib/speech/use-speech";
import { useAiChat } from "@/lib/ai/use-ai-chat";
import {
  Send,
  Mic,
  MicOff,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Bot,
  Server,
  Cpu,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  source?: "groq" | "mock" | "tauri-rag";
  images?: { path: string; metadataPath: string }[];
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHAT_STORAGE_KEY = "chat-ia-messages";

type StoredMessage = Omit<Message, "timestamp"> & { timestamp: string };

export default function ChatIAPage() {
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    transcript,
    stopListening,
    speak,
    stopSpeaking,
    toggleListening,
  } = useSpeech({ language: "fr-FR", continuous: false });

  const { messages, sendMessage, isLoading, source, clearHistory } = useAiChat({
    initialMessages: [],
    onFallback: (reason) => console.warn("Chat IA fallback:", reason),
  });

  // Load session messages safely after mount (avoids SSR crash)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed: StoredMessage[] = JSON.parse(raw);
      const loaded: Message[] = parsed.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      if (loaded.length > 0) {
        // We need to set initial messages, but useAiChat manages its own state
        // For now, just keep the loaded messages in sessionStorage
        // The hook will handle new messages
      }
    } catch {
      // sessionStorage unavailable or corrupt — ignore
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = area;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };
    area.addEventListener("scroll", handleScroll);
    return () => area.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (transcript && voiceMode) {
      // Find the input element and set its value
      inputRef.current?.focus();
    }
  }, [transcript, voiceMode]);

  const handleSend = useCallback(async () => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    const trimmed = inputEl.value.trim();
    if (!trimmed) return;

    inputEl.value = "";
    setVoiceMode(false);
    stopListening();
    await sendMessage(trimmed);
  }, [sendMessage, stopListening]);

  useEffect(() => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleClearChat = useCallback(() => {
    clearHistory();
    setVoiceMode(false);
    stopListening();
    stopSpeaking();
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  }, [clearHistory, stopListening, stopSpeaking]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (voiceMode) {
      setVoiceMode(false);
      stopListening();
    } else {
      setVoiceMode(true);
      toggleListening();
    }
  }, [voiceMode, toggleListening, stopListening]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <section className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/95 px-4 py-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <NexaFlowLogo className="h-8 w-8" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Assistant IA</h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-xs text-muted-foreground">En ligne</p>
                {source && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted border border-border">
                    {source === "groq" ? (
                      <>
                        <Server className="h-2.5 w-2.5" />
                        GROQ
                      </>
                    ) : (
                      <>
                        <Cpu className="h-2.5 w-2.5" />
                        Local
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-muted"
              onClick={handleClearChat}
              title="Effacer la conversation"
            >
              <Trash2 className="h-4 w-4 text-foreground/60" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden relative">
        <ScrollArea className="flex-1 px-4 py-6 sm:px-6" ref={scrollAreaRef}>
          <div className="space-y-6 pb-4">

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const showAvatar = !isUser && (index === 0 || messages[index - 1].role !== "assistant");

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} ${showAvatar ? "mt-4" : "mt-1"}`}
                >
                  {showAvatar ? (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}

                  <div
                    className={`group flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[75%]`}
                  >
                    <Card
                      className={`px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                          : "bg-muted/50 text-foreground rounded-2xl rounded-bl-sm border border-border/50"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      {!isUser && message.images && message.images.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {message.images.map((img, idx) => (
                            <div key={idx} className="rounded-lg overflow-hidden border border-border/60 bg-background">
                              <img
                                src={img.path}
                                alt={message.content}
                                className="w-full h-40 object-cover"
                              />
                              <a
                                href={img.metadataPath}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] text-muted-foreground px-2 py-1 truncate"
                              >
                                Métadonnées
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <div
                      className={`flex items-center gap-1.5 mt-1 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                      {isUser && (
                        <Check className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      {!isUser && message.source && (
                        <span className="text-[10px] text-muted-foreground/60 ml-1">
                          {message.source === "groq" ? "GROQ" : "Local"}
                        </span>
                      )}
                    </div>

                    {!isUser && (
                      <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6"
                          onClick={() => handleCopy(message.id, message.content)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-end gap-2 mt-4">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="text-xs text-muted-foreground">L'assistant réfléchit</span>
                  </div>
                </Card>
              </div>
            )}

            <div id="messages-end" ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {showScrollBtn && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-lg h-8 w-8 p-0"
              onClick={scrollToBottom}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Separator />

        <div className="border-t border-border bg-background px-4 py-3 sm:px-6 pb-6">
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <div className="relative mx-auto w-full max-w-2xl">
              <input
                ref={inputRef}
                type="text"
                onChange={(e) => {}}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez votre message..."
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-24"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={handleVoiceToggle}
                  title={voiceMode ? "Arrêter l'écoute" : "Mode vocal"}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4 text-destructive" />
                  ) : (
                    <Mic className="h-4 w-4 text-foreground/60" />
                  )}
                </Button>

                <Button
                  variant="default"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={handleSend}
                  disabled={!inputRef.current?.value.trim() || isLoading}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Appuyez sur Entrée pour envoyer • Le mode vocal utilise la reconnaissance vocale
          </p>
        </div>
      </div>
    </section>
  );
}