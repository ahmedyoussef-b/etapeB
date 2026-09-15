import { Plus, Trash2, MessageSquare, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import {
  listConversations,
  createConversation,
  deleteConversation,
  type Conversation,
} from '../../services/conversation-store';

interface ConversationSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export default function ConversationSidebar({
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    listConversations()
  );

  const refresh = () => setConversations(listConversations());

  const handleCreate = () => {
    const conv = createConversation();
    refresh();
    onCreate();
    onSelect(conv.id);
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    refresh();
    onDelete(id);
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Conversations
        </h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Aucune conversation</p>
          </div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${
              activeId === conv.id
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/50 border border-transparent'
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-foreground font-medium">
                {conv.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {conv.messages.length} messages
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
