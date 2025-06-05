import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Smile,
  Send,
  MoreVertical,
  Phone,
  Video,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

export const Chat = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [messageInput, setMessageInput] = useState('');
  const { getChat, sendMessage, currentUser } = useChat();

  const chat = getChat(id || '');

  if (!chat) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Chat not found</h2>
          <button
            onClick={() => navigate('/chats')}
            className="text-primary hover:underline"
          >
            Return to chat list
          </button>
        </div>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !id) return;
    sendMessage(id, messageInput);
    setMessageInput('');
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/chats')}
            className="rounded-full p-2 hover:bg-muted md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <span className="text-lg font-medium text-primary">
              {chat.name[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-medium">{chat.name}</h2>
            <p className="text-sm text-muted-foreground">
              {chat.participants.length} participants
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 hover:bg-muted">
            <Search className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-muted">
            <Phone className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-muted">
            <Video className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-muted">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {chat.messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  message.sender.id === currentUser.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {message.sender.id !== currentUser.id && (
                  <p className="mb-1 text-xs font-medium">{message.sender.name}</p>
                )}
                <p className="text-sm">{message.content}</p>
                <p className="mt-1 text-right text-xs opacity-70">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Smile className="h-5 w-5" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="rounded-full bg-primary p-2 text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}; 