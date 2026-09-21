"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSpeech } from "@/lib/speech/use-speech";
import { Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, Database, Server, Mic, MicOff, Volume2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";

interface QAItem {
  question: string;
  answer: string;
}

interface SendResult {
  success: boolean;
  message: string;
}

export default function QAPage() {
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

  // Process transcript for "non" correction and silence detection
  useEffect(() => {
    if (!transcript) return;

    // Check for standalone "non" (correction command)
    const words = transcript.trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();

    if (lastWord === "non" && words.length > 1) {
      // Remove the last word before "non" (undo last spoken word)
      const corrected = words.slice(0, -1).join(" ");
      setQuestion(corrected);
      lastTranscriptRef.current = corrected;
      speak("Annulé. Continuez à parler.");
      return;
    }

    lastTranscriptRef.current = transcript;
    setQuestion(transcript);

    // Reset silence timer on each transcript update
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    // Set 5-second silence timer
    const timer = setTimeout(() => {
      if (isListening) {
        stopListening();
        // Auto-focus answer field and prompt
        answerRef.current?.focus();
        speak("Donnez ta réponse.");
      }
    }, 5000);

    setSilenceTimer(timer);
  }, [transcript, isListening, silenceTimer, speak, stopListening]);

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
      // Auto-focus answer field regardless of mic state
      // If mic is listening, stop it first to avoid conflicts
      if (isListening) {
        stopListening();
      }
      answerRef.current?.focus();
      speak("Tapez ta réponse.");
    }, 5000);

    setTypingTimer(timer);
    return () => clearTimeout(timer);
  }, [question, isListening, speak]);

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
      const rawName = (customFilename || filenameRef.current || 'qa_export.json').trim() || 'qa_export.json';
      const name = rawName.endsWith('.json') ? rawName : `${rawName}.json`;

      if (isTauriEnv()) {
        try {
          const userPath = await invoke<string>('get_user_data_path');
          const fullPath = `${userPath}/repository/registry/items/${name}`;
          const res = await invoke<any>('read_file_content', { path: fullPath }).catch(() => null);
          if (res && res.textContent) {
            const parsed = JSON.parse(res.textContent);
            if (Array.isArray(parsed)) {
              setHistoryItems(parsed);
            }
          }
        } catch {}
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/file-content?path=registry/items/${encodeURIComponent(name)}&source=web`);
      if (!res.ok) {
        setHistoryItems([]);
        return;
      }
      const data = await res.json();
      if (data.success && data.kind === 'text') {
        try {
          const parsed = JSON.parse(data.content);
          if (Array.isArray(parsed)) {
            setHistoryItems(parsed);
          }
        } catch {}
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const handleFilenameChange = (value: string) => {
    setFilename(value);
    filenameRef.current = value;
  };

  const handleFilenameBlur = () => {
    // Normalize on blur: append .json if missing
    const trimmed = filename.trim();
    const final = trimmed && !trimmed.endsWith('.json') ? `${trimmed}.json` : trimmed;
    if (final !== filename) {
      setFilename(final);
      filenameRef.current = final;
    }
  };

  const handleDeleteFromHistory = (index: number) => {
    const updated = historyItems.filter((_, i) => i !== index);
    setHistoryItems(updated);
    // Persist back to BDD with the current filename
    const currentName = (filenameRef.current || 'qa_export.json').trim() || 'qa_export.json';
    const jsonContent = JSON.stringify(updated, null, 2);

    if (isTauriEnv()) {
      (async () => {
        try {
          const userPath = await invoke<string>('get_user_data_path');
          const fullPath = `${userPath}/repository/registry/items/${currentName}`;
          await invoke('write_file_content', { path: fullPath, content: jsonContent });
        } catch {}
      })();
      return;
    }

    fetch('/api/q-r/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updated, filename: currentName, replace: true }),
    }).catch(() => {});
  };

  useEffect(() => { loadExistingQr(); }, [loadExistingQr]);

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

    const rawName = filename.trim() || 'qa_export.json';
    const finalName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    setIsSending(true);
    setSendResult(null);
    setSendError(null);

    try {
      if (isTauriEnv()) {
        const userPath = await invoke<string>('get_user_data_path');
        const fullPath = `${userPath}/repository/registry/items/${finalName}`;
        const jsonContent = JSON.stringify(items, null, 2);
        await invoke('write_file_content', { path: fullPath, content: jsonContent });
        setSendResult({ success: true, message: "Enregistré avec succès dans la base locale" });
        setItems([]);
        setEditingIndex(null);
        setQuestion("");
        setAnswer("");
        setFilename(finalName);
        filenameRef.current = finalName;
        await loadExistingQr(finalName);
        return;
      }

      const response = await fetch('/api/q-r/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      // Preserve the user's custom filename — do NOT reset to default
      setFilename(finalName);
      filenameRef.current = finalName;
      // Recharger l'historique avec le bon nom de fichier
      loadExistingQr(finalName);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions / Réponses
          </h1>
        </div>

        <div className="mt-8">
          <form
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="question"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
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
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="answer"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
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
                <label
                  htmlFor="filename"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
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
                  <Button
                    type="button"
                    onClick={cancelEdit}
                    variant="outline"
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        {historyItems.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  Historique des Q/R
                </h2>
                <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs">
                  {historyItems.length}
                </Badge>
              </div>
            </div>
            <div className="mt-6">
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
                              window.scrollTo({ top: 0, behavior: 'smooth' });
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
          </div>
        )}

        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                Collecteur de Q/R
              </h2>
              <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs">
                {items.length}
              </Badge>
            </div>
          </div>

          <div className="mt-6">
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
      </div>
    </section>
  );
}
