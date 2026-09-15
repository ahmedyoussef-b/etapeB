import { ThumbsUp, ThumbsDown, AlertCircle, Loader2 } from 'lucide-react';
import type { Message } from '../../services/conversation-store';

interface ChatMessageProps {
  message: Message;
  onFeedback?: (msgId: string, feedback: 'positive' | 'negative') => void;
}

export default function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isLoading = message.role === 'assistant' && !message.content && !message.error;

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      data-message-id={message.id}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? 'U' : '🤖'}
      </div>
      <div className={`flex max-w-[80%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground border border-border'
          }`}
        >
          {isLoading && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </span>
          )}
          {!isLoading && message.error && (
            <span className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              {message.error}
            </span>
          )}
          {!isLoading && !message.error && message.content}
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {!isUser && message.role === 'assistant' && (
          <div className="mt-1 flex gap-1">
            {message.feedback !== 'positive' && (
              <button
                onClick={() => onFeedback?.(message.id, 'positive')}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                title="Utile"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
            )}
            {message.feedback !== 'negative' && (
              <button
                onClick={() => onFeedback?.(message.id, 'negative')}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-500 transition-colors"
                title="Utile"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            )}
            {message.feedback === 'positive' && (
              <ThumbsUp className="h-3.5 w-3.5 text-primary" />
            )}
            {message.feedback === 'negative' && (
              <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
