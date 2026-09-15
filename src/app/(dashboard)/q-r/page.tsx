"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  WifiOff,
  Wifi,
  AlertCircle,
} from "lucide-react";
import {
  listConversations,
  createConversation,
  deleteConversation,
  getConversation,
  addMessage,
  updateMessageContent,
  updateMessageSources,
  updateMessageFeedback,
  exportAsMarkdown,
  generateMessageId,
  type Conversation,
  type Message,
} from "@/services/conversation-store";
import { askRagStream } from "@/services/rag-stream";
import { isTauriEnv } from "@/services/local-rag";
import { ConversationSidebar } from "@/components/qr/ConversationSidebar";
import { ChatInput } from "@/components/qr/ChatInput";
import { ChatMessage } from "@/components/qr/ChatMessage";

export default function QAPage() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    listConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const refreshConversations = useCallback(() => {
    setConversations(listConversations());
  }, []);

  useEffect(() => {
    refreshConversations();

    const handleOnline = () => {
      setOffline(false);
      setShowOfflineBanner(false);
    };
    const handleOffline = () => {
      setOffline(true);
      setShowOfflineBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (typeof navigator !== "undefined") {
      setOffline(!navigator.onLine);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshConversations]);

  useEffect(() => {
    if (conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
      conversationIdRef.current = conversations[0].id;
    }
  }, [conversations, activeId]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    conversationIdRef.current = id;
  }, []);

  const handleCreate = useCallback(() => {
    const conv = createConversation();
    refreshConversations();
    setActiveId(conv.id);
    conversationIdRef.current = conv.id;
  }, [refreshConversations]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteConversation(id);
      refreshConversations();
      if (activeId === id) {
        const remaining = listConversations();
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        conversationIdRef.current = remaining.length > 0 ? remaining[0].id : null;
      }
    },
    [activeId, refreshConversations]
  );

  const currentConversation = activeId ? getConversation(activeId) : null;

  const handleSend = useCallback(
    async (question: string) => {
      if (!activeId || isStreaming) return;

      const convId = activeId;
      const msgId = generateMessageId();
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content: question,
        timestamp: Date.now(),
      };
      const assistantMessage: Message = {
        id: msgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        error: undefined,
      };

      addMessage(convId, userMessage);
      addMessage(convId, assistantMessage);
      setConversations(listConversations());

      setIsStreaming(true);

      if (offline) {
        setShowOfflineBanner(true);
      }

      const cleanup = await askRagStream(question, convId, {
        onToken: (token) => {
          const updated = getConversation(convId);
          if (!updated) return;
          const msg = updated.messages.find((m) => m.id === msgId);
          if (msg) {
            msg.content = assistantMessage.content + token;
            updateMessageContent(convId, msgId, msg.content);
            setConversations(listConversations());
          }
        },
        onDone: (sources, fullAnswer) => {
          const updated = getConversation(convId);
          if (!updated) return;
          const msg = updated.messages.find((m) => m.id === msgId);
          if (msg) {
            msg.content = fullAnswer;
            if (sources.length > 0) {
              msg.sources = sources;
            }
            updateMessageContent(convId, msgId, msg.content);
            if (msg.sources) {
              updateMessageSources(convId, msgId, msg.sources);
            }
          }
          setIsStreaming(false);
          refreshConversations();
        },
        onError: (error) => {
          const updated = getConversation(convId);
          if (!updated) return;
          const msg = updated.messages.find((m) => m.id === msgId);
          if (msg) {
            msg.error = error;
            updateMessageContent(convId, msgId, "Erreur : " + error);
          }
          setIsStreaming(false);
          refreshConversations();
        },
      });

      cleanup();
    },
    [activeId, isStreaming, offline, refreshConversations]
  );

  const handleFeedback = useCallback(
    (msgId: string, feedback: "positive" | "negative" | null) => {
      if (!activeId) return;
      updateMessageFeedback(activeId, msgId, feedback);
      refreshConversations();
    },
    [activeId, refreshConversations]
  );

  const handleExport = useCallback(() => {
    if (!activeId) return;
    const md = exportAsMarkdown(activeId);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${activeId.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeId]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onExport={handleExport}
      />

      <div className="flex flex-1 flex-col">
        {showOfflineBanner && (
          <div className="flex items-center gap-2 border-b border-border bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            <WifiOff className="h-4 w-4" />
            Mode recherche locale uniquement — connexion internet indisponible
            {isTauriEnv() && (
              <Wifi className="ml-auto h-4 w-4 text-green-600" />
            )}
          </div>
        )}

        {currentConversation && (
          <>
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {currentConversation.title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentConversation.messages.length} messages
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Markdown
                </button>
                <button
                  onClick={() => handleDelete(currentConversation.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <AlertCircle className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {currentConversation.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Posez votre première question</p>
                </div>
              )}

              {currentConversation.messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onFeedback={handleFeedback}
                  isStreaming={isStreaming && msg.role === "assistant" && !msg.error}
                />
              ))}
            </div>

            {currentConversation.messages.length > 0 && (
              <div className="border-t border-border">
                <ChatInput
                  onSend={handleSend}
                  disabled={isStreaming}
                  isStreaming={isStreaming}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
