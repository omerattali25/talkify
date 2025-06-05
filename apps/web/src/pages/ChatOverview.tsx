import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  MessageSquare,
  Archive,
  Users,
  Search,
  MoreVertical,
  Plus,
  Filter,
  Bell,
  BellOff,
} from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'archived', label: 'Archived' },
];

export const ChatOverview = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { chats, searchChats, getArchivedChats, getUnreadChats, deleteChat, archiveChat } = useChat();

  // Filter chats based on active tab and search query
  const filteredChats = (() => {
    let filtered = [];
    switch (activeTab) {
      case 'archived':
        filtered = getArchivedChats();
        break;
      case 'unread':
        filtered = getUnreadChats();
        break;
      default:
        filtered = chats.filter((chat) => !chat.isArchived);
    }
    return searchQuery ? searchChats(searchQuery) : filtered;
  })();

  return (
    <div className="flex h-screen bg-background">
      {/* Mini Settings Sidebar */}
      <div className="flex w-20 flex-col items-center border-r border-border bg-card py-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/settings')}
          className={`mb-4 rounded-full p-3 transition-colors hover:bg-muted`}
        >
          <Settings className="h-6 w-6" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-full p-3 text-primary hover:bg-muted"
        >
          <MessageSquare className="h-6 w-6" />
        </motion.button>
      </div>

      {/* Chat List Section */}
      <div className="flex w-80 flex-col border-r border-border">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Chats</h2>
            <div className="flex items-center gap-2">
              <button className="rounded-full p-2 hover:bg-muted">
                <Plus className="h-5 w-5" />
              </button>
              <button className="rounded-full p-2 hover:bg-muted">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button className="rounded-full p-2 hover:bg-muted">
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.id === 'unread' && getUnreadChats().length > 0 && (
                  <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                    {getUnreadChats().length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <motion.div
              key={chat.id}
              className="group relative"
            >
              <motion.button
                onClick={() => navigate(`/chat/${chat.id}`)}
                whileHover={{ backgroundColor: 'hsl(var(--muted))' }}
                className="flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-lg font-medium text-primary">
                    {chat.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{chat.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(chat.lastMessage?.createdAt || '').toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-sm text-muted-foreground">
                      {chat.lastMessage?.content}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
              {/* Quick Actions */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => archiveChat(chat.id)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main Content Area - Empty State */}
      <div className="flex flex-1 items-center justify-center bg-muted/5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Select a chat to start messaging</h2>
          <p className="text-muted-foreground">
            Choose from your existing conversations or start a new one
          </p>
        </div>
      </div>

      {/* Settings Sidebar */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            className="absolute right-0 top-0 h-full w-80 border-l border-border bg-card"
          >
            <div className="p-6">
              <h2 className="mb-6 text-xl font-semibold">Settings</h2>
              <div className="space-y-4">
                <button className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
                  <Users className="h-5 w-5" />
                  <span>Profile</span>
                </button>
                <button className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
                  <Bell className="h-5 w-5" />
                  <span>Notifications</span>
                </button>
                <button className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
                  <Archive className="h-5 w-5" />
                  <span>Archived Chats</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 