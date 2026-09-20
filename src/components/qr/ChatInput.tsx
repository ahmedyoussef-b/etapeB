'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');
  
  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
  }
  
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
  
  return (
    <div className="border-t p-4 bg-white">
      <div className="max-w-4xl mx-auto flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez votre question..."
          disabled={disabled || isStreaming}
          rows={1}
          className="flex-1 resize-none border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          style={{ minHeight: '42px', maxHeight: '200px' }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled || isStreaming}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isStreaming ? '⏳' : 'Envoyer'}
        </button>
      </div>
      <div className="text-xs text-gray-400 text-center mt-2">
        Entrée pour envoyer • Maj+Entrée pour nouvelle ligne
      </div>
    </div>
  );
}
