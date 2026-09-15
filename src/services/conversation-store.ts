export interface RagSource {
  path: string;
  directory: string;
  filename: string;
  chunk: string;
  chunkIndex: number;
  similarity: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: RagSource[];
  feedback?: 'positive' | 'negative' | null;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'nexaflow-conversations';
const MAX_CONVERSATIONS = 100;

function loadAll(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error('[conversation-store] load error:', error);
    return [];
  }
}

function saveAll(convs: Conversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const pruned = convs
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch (error) {
    console.error('[conversation-store] save error:', error);
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function listConversations(): Conversation[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  return loadAll().find(c => c.id === id) || null;
}

export function createConversation(): Conversation {
  const conv: Conversation = {
    id: generateId(),
    title: 'Nouvelle conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = loadAll();
  all.push(conv);
  saveAll(all);
  return conv;
}

export function addMessage(convId: string, message: Message): void {
  const all = loadAll();
  const conv = all.find(c => c.id === convId);
  if (!conv) return;
  conv.messages.push(message);
  conv.updatedAt = Date.now();
  if (conv.title === 'Nouvelle conversation' && message.role === 'user') {
    conv.title = message.content.split(/\s+/).slice(0, 5).join(' ');
  }
  saveAll(all);
}

export function updateMessageContent(
  convId: string,
  msgId: string,
  content: string
): void {
  const all = loadAll();
  const conv = all.find(c => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === msgId);
  if (!msg) return;
  msg.content = content;
  conv.updatedAt = Date.now();
  saveAll(all);
}

export function updateMessageSources(
  convId: string,
  msgId: string,
  sources: RagSource[]
): void {
  const all = loadAll();
  const conv = all.find(c => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === msgId);
  if (!msg) return;
  msg.sources = sources;
  saveAll(all);
}

export function updateMessageFeedback(
  convId: string,
  msgId: string,
  feedback: 'positive' | 'negative' | null
): void {
  const all = loadAll();
  const conv = all.find(c => c.id === convId);
  if (!conv) return;
  const msg = conv.messages.find(m => m.id === msgId);
  if (!msg) return;
  msg.feedback = feedback;
  saveAll(all);
}

export function deleteConversation(id: string): void {
  const all = loadAll().filter(c => c.id !== id);
  saveAll(all);
}

export function renameConversation(id: string, title: string): void {
  const all = loadAll();
  const conv = all.find(c => c.id === id);
  if (!conv) return;
  conv.title = title;
  saveAll(all);
}

export function exportAsMarkdown(id: string): string {
  const conv = getConversation(id);
  if (!conv) return '';

  const lines: string[] = [];
  lines.push(`# ${conv.title}`);
  lines.push('');
  lines.push(`**Date** : ${new Date(conv.createdAt).toLocaleString('fr-FR')}`);
  lines.push(`**Messages** : ${conv.messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of conv.messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR');
    if (msg.role === 'user') {
      lines.push(`### 👤 Utilisateur (${time})`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
    } else {
      lines.push(`### 🤖 Assistant (${time})`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      if (msg.sources && msg.sources.length > 0) {
        lines.push('**Sources :**');
        for (const s of msg.sources) {
          lines.push(`- \`${s.path}\` (${Math.round(s.similarity * 100)}%)`);
        }
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function generateMessageId(): string {
  return generateId();
}
