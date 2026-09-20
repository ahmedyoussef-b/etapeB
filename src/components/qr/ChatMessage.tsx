'use client';

import { useState } from 'react';
import type { Message } from '@/services/conversation-store';
import { SourceCard } from './SourceCard';

interface ChatMessageProps {
  message: Message;
  onFeedback: (messageId: string, feedback: 'positive' | 'negative' | null) => void;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onFeedback, isStreaming }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  
  const isUser = message.role === 'user';
  
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  }
  
  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-2xl bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-3xl bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        {message.error ? (
          <div className="text-red-600 text-sm">
            ⚠️ {message.error}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
            )}
          </div>
        )}
        
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">
              📚 Sources ({message.sources.length})
            </div>
            <div className="space-y-2">
              {message.sources.map((s, i) => (
                <SourceCard key={i} source={s} />
              ))}
            </div>
          </div>
        )}
        
        {!message.error && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            <button
              onClick={() => onFeedback(message.id, message.feedback === 'positive' ? null : 'positive')}
              className={`px-2 py-1 text-xs rounded hover:bg-gray-100 ${
                message.feedback === 'positive' ? 'bg-green-100 text-green-700' : 'text-gray-500'
              }`}
            >
              👍
            </button>
            <button
              onClick={() => onFeedback(message.id, message.feedback === 'negative' ? null : 'negative')}
              className={`px-2 py-1 text-xs rounded hover:bg-gray-100 ${
                message.feedback === 'negative' ? 'bg-red-100 text-red-700' : 'text-gray-500'
              }`}
            >
              👎
            </button>
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-500"
            >
              {copied ? '✓ Copié' : '📋 Copier'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
