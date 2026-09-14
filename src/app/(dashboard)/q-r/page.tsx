"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSpeech } from "@/lib/speech/use-speech";
import {
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  Server,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Search,
  BookOpen,
  RefreshCw,
  Folder,
  FileText,
} from "lucide-react";
import {
  askLocalRag,
  getVectorizationStats,
  triggerLocalVectorization,
  RagSource,
  VectorizationStats,
  isTauriEnv,
} from "@/services/local-rag";

interface QAItem {
  question: string;
  answer: string;
}

interface SendResult {
  success: boolean;
  message: string;
}

export default function QAPage() {
  const [activeTab, setActiveTab] = useState<"rag" | "collector">("rag");

  // Local RAG state
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const [ragStats, setRagStats] = useState<VectorizationStats | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const isTauri = isTauriEnv();

  // Collector state
  const [items, setItems] = useState<QAItem[]>([]);
  const [historyItems, setHistoryItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [filename, setFilename] = useState("qa_export.json");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeted, setGreeted] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasTypedQuestion, setHasTypedQuestion] = useState(false);
  const filenameRef = useRef("qa_export.json");
  const questionRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const lastTranscriptRef = useRef("");

  const speech = useSpeech({ language: "fr-FR" });
  const { isListening, isSpeaking, speak, toggleListening, stopListening, transcript } = speech;

  const loadStats = useCallback(async () => {
    if (!isTauri) return;
    try {
      const stats = await getVectorizationStats();
      setRagStats(stats);
    } catch (err) {
      console.warn("Erreur chargement stats vectorielles:", err);
    }
  }, [isTauri]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAskRag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ragQuestion.trim() || ragLoading) return;

    setRagLoading(true);
    setRagError(null);
    setRagAnswer(null);
    setRagSources([]);

    try {
      const result = await askLocalRag(ragQuestion.trim());
      setRagAnswer(result.answer);
      setRagSources(result.sources);
    } catch (err) {
      setRagError(err instanceof Error ? err.message : "Erreur lors de la requête RAG local");
    } finally {
      setRagLoading(false);
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const stats = await triggerLocalVectorization();
      setRagStats(stats);
    } catch (err) {
      console.error("Erreur réindexation:", err);
    } finally {
      setIsReindexing(false);
    }
  };

  // Process transcript for "non" correction and silence detection
  useEffect(() => {
    if (!transcript) return;

    const words = transcript.trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();

    if (lastWord === "non" && words.length > 1) {
      const corrected = words.slice(0, -1).join(" ");
      if (activeTab === "rag") {
        setRagQuestion(corrected);
      } else {
        setQuestion(corrected);
      }
      lastTranscriptRef.current = corrected;
      speak("Annulé. Continuez à parler.");
      return;
    }

    lastTranscriptRef.current = transcript;
    if (activeTab === "rag") {
      setRagQuestion(transcript);
    } else {
      setQuestion(transcript);
    }

    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    const timer = setTimeout(() => {
      if (isListening) {
        stopListening();
        if (activeTab === "collector") {
          answerRef.current?.focus();
          speak("Donnez ta réponse.");
        }
      }
    }, 5000);

    setSilenceTimer(timer);
  }, [transcript, isListening, silenceTimer, speak, stopListening, activeTab]);

  // Typing timer: auto-focus answer field after 5s of typing inactivity
  useEffect(() => {
    if (typingTimer) {
      clearTimeout(typingTimer);
    }

    if (!question.trim()) {
      setHasTypedQuestion(false);
      return;
    }

    setHasTypedQuestion(true);

    const timer = setTimeout(() => {
      if (isListening) {
        stopListening();
      }
      answerRef.current?.focus();
      speak("Tapez ta réponse.");
    }, 5000);

    setTypingTimer(timer);
    return () => clearTimeout(timer);
  }, [question, isListening, speak, typingTimer]);

  const handleToggleMicro = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    if (!greeted) {
      setGreeted(true);
      speak("Bonjour, je suis prêt pour les questions-réponses.");
      const checkSpeaking = setInterval(() => {
        if (!isSpeaking) {
          clearInterval(checkSpeaking);
          questionRef.current?.focus();
          speak("Posez votre question");
          setTimeout(() => {
            if (!isSpeaking) {
              toggleListening();
            }
          }, 1200);
        }
      }, 200);
    } else {
      questionRef.current?.focus();
      toggleListening();
    }
  }, [isListening, isSpeaking, greeted, speak, toggleListening, stopListening]);

  const loadExistingQr = useCallback(async (customFilename?: string) => {
    try {
      const rawName = (customFilename || filenameRef.current || "qa_export.json").trim() || "qa_export.json";
      const name = rawName.endsWith(".json") ? rawName : `${rawName}.json`;
      const res = await fetch(`/api/file-content?path=registry/items/${encodeURIComponent(name)}&source=web`);
      if (!res.ok) {
        setHistoryItems([]);
        return;
      }
      const data = await res.json();
      if (data.success && data.kind === "text") {
        try {
          const parsed = JSON.parse(data.content);
          if (Array.isArray(parsed)) {
            setHistoryItems(parsed);
          }
        } catch {}
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const handleFilenameChange = (value: string) => {
    setFilename(value);
    filenameRef.current = value;
  };

  const handleFilenameBlur = () => {
    const trimmed = filename.trim();
    const final = trimmed && !trimmed.endsWith(".json") ? `${trimmed}.json` : trimmed;
    if (final !== filename) {
      setFilename(final);
      filenameRef.current = final;
    }
  };

  const handleDeleteFromHistory = (index: number) => {
    const updated = historyItems.filter((_, i) => i !== index);
    setHistoryItems(updated);
    const currentName = (filenameRef.current || "qa_export.json").trim() || "qa_export.json";
    fetch("/api/q-r/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updated, filename: currentName, replace: true }),
    }).catch(() => {});
  };

  useEffect(() => {
    loadExistingQr();
  }, [loadExistingQr]);

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) return;
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = { question: question.trim(), answer: answer.trim() };
      setItems(updated);
      setEditingIndex(null);
    } else {
      setItems([...items, { question: question.trim(), answer: answer.trim() }]);
    }
    setQuestion("");
    setAnswer("");
  };

  const handleEdit = (index: number) => {
    setQuestion(items[index].question);
    setAnswer(items[index].answer);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setQuestion("");
      setAnswer("");
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setQuestion("");
    setAnswer("");
  };

  const handleSend = async () => {
    if (items.length === 0 || isSending) return;

    const rawName = filename.trim() || "qa_export.json";
    const finalName = rawName.endsWith(".json") ? rawName : `${rawName}.json`;
    setIsSending(true);
    setSendResult(null);
    setSendError(null);

    try {
      const response = await fetch("/api/q-r/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, filename: finalName }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'envoi vers la BDD Web");
      }

      setSendResult({ success: true, message: data.message });
      setItems([]);
      setEditingIndex(null);
      setQuestion("");
      setAnswer("");
      setFilename(finalName);
      filenameRef.current = finalName;
      loadExistingQr(finalName);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Intelligence & Base Documentaire (Q/R)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recherche RAG vectorielle locale et gestion des connaissances industrielles.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("rag")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "rag"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Assistant RAG Local
            </button>
            <button
              onClick={() => setActiveTab("collector")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "collector"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Database className="h-4 w-4" />
              Gestionnaire Q/R BDD
            </button>
          </div>
        </div>

        {activeTab === "rag" ? (
          <div className="space-y-6">
            {/* RAG Stats Banner */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">BDD Vectorielle Locale (ChromaDB)</h3>
                    <p className="text-xs text-muted-foreground">
                      Miroir vectorisé du dossier local <code className="text-primary font-mono">%APPDATA%/NexaFlow/repository</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {ragStats && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="bg-background">
                        {ragStats.vectorizedFiles}/{ragStats.totalFiles} fichiers
                      </Badge>
                      <Badge variant="secondary">
                        {ragStats.totalChunks} chunks vectorisés
                      </Badge>
                    </div>
                  )}

                  {isTauri && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReindex}
                      disabled={isReindexing}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isReindexing ? "animate-spin" : ""}`} />
                      {isReindexing ? "Indexation..." : "Réindexer"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* RAG Query Box */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <form onSubmit={handleAskRag} className="space-y-4">
                <div>
                  <label htmlFor="rag-query" className="mb-2 block text-sm font-medium text-foreground">
                    Poser une question technique à la base documentaire locale
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="rag-query"
                      value={ragQuestion}
                      onChange={(e) => setRagQuestion(e.target.value)}
                      placeholder="Ex: Quelle est la procédure de démarrage de la turbine à gaz ?"
                      className="flex-1"
                      disabled={ragLoading}
                    />
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      size="icon"
                      onClick={handleToggleMicro}
                      className="shrink-0"
                      title={isListening ? "Arrêter l'écoute" : "Poser la question à la voix"}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button type="submit" disabled={ragLoading || !ragQuestion.trim()} className="gap-2">
                      {ragLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Recherche...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Interroger
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {ragError && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{ragError}</span>
                </div>
              )}

              {/* RAG Answer Display */}
              {ragAnswer && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
                      <Sparkles className="h-4 w-4" />
                      Réponse RAG Locale
                    </div>
                    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {ragAnswer}
                    </div>
                  </div>

                  {/* Sources List */}
                  {ragSources.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Sources documentaires locales ({ragSources.length})
                      </h4>
                      <div className="grid gap-2">
                        {ragSources.map((source, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border bg-background p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                {source.path}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                Similarité: {(source.similarity * 100).toFixed(1)}%
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-3 bg-muted/40 p-2 rounded">
                              {source.chunk}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd();
              }}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="question" className="mb-1.5 block text-sm font-medium text-foreground">
                    Question
                  </label>
                  <div className="flex gap-2">
                    <Input
                      ref={questionRef}
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Tapez ou dites votre question..."
                      autoComplete="off"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      size="icon"
                      onClick={handleToggleMicro}
                      className="shrink-0"
                      title={isListening ? "Arrêter l'écoute" : "Parler"}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label htmlFor="answer" className="mb-1.5 block text-sm font-medium text-foreground">
                    Réponse
                  </label>
                  <Input
                    ref={answerRef}
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Tapez la réponse correspondante..."
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="filename" className="mb-1.5 block text-sm font-medium text-foreground">
                    Nom du fichier
                  </label>
                  <Input
                    id="filename"
                    value={filename}
                    onChange={(e) => handleFilenameChange(e.target.value)}
                    onBlur={handleFilenameBlur}
                    placeholder="qa_export.json"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="submit" className="flex-1">
                    {editingIndex !== null ? "Modifier" : "Ajouter"}
                  </Button>
                  {editingIndex !== null && (
                    <Button type="button" onClick={cancelEdit} variant="outline" className="flex-1">
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </form>

            {historyItems.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">Historique des Q/R</h2>
                    <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs">
                      {historyItems.length}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="space-y-2.5">
                    {historyItems.map((item, i) => (
                      <div
                        key={i}
                        className="group rounded-xl border border-border bg-card/60 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 text-sm break-words leading-relaxed">
                            <span className="font-semibold text-foreground">{`{Q:`}</span>
                            <span className="mx-1 text-foreground">{item.question}</span>
                            <span className="text-foreground">{`; R:`}</span>
                            <span className="mx-1 text-muted-foreground">{item.answer}</span>
                            <span className="font-semibold text-foreground">{`}`}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setQuestion(item.question);
                                setAnswer(item.answer);
                                setEditingIndex(null);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              aria-label="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFromHistory(i)}
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">Collecteur de Q/R</h2>
                  <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs">
                    {items.length}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      setItems([]);
                      setEditingIndex(null);
                      setQuestion("");
                      setAnswer("");
                    }}
                  >
                    vider
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg"
                    onClick={handleSend}
                    disabled={isSending || items.length === 0}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        envoi...
                      </>
                    ) : (
                      "envoyer"
                    )}
                  </Button>
                </div>

                {sendResult && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{sendResult.message}</span>
                  </div>
                )}

                {sendError && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{sendError}</span>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                    Aucune Q/R enregistrée pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {items.map((item, i) => (
                      <div
                        key={i}
                        className="group rounded-xl border border-border bg-card/60 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 text-sm break-words leading-relaxed">
                            <span className="font-semibold text-foreground">{`{Q:`}</span>
                            <span className="mx-1 text-foreground">{item.question}</span>
                            <span className="text-foreground">{`; R:`}</span>
                            <span className="mx-1 text-muted-foreground">{item.answer}</span>
                            <span className="font-semibold text-foreground">{`}`}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(i)}
                              aria-label="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(i)}
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
