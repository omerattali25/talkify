import { motion } from 'framer-motion';
import { MessageSquare, Image as ImageIcon, Smile, Send } from 'lucide-react';

const messages = [
  {
    id: 1,
    content: 'Hey there! 👋',
    sender: 'Sarah',
    time: '9:41 AM',
    isCurrentUser: false,
  },
  {
    id: 2,
    content: 'Hi Sarah! How are you?',
    sender: 'You',
    time: '9:42 AM',
    isCurrentUser: true,
  },
  {
    id: 3,
    content: "I'm doing great! Just checking out this awesome chat app 😊",
    sender: 'Sarah',
    time: '9:43 AM',
    isCurrentUser: false,
  },
];

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.5,
      ease: 'easeOut',
    },
  }),
};

export const ChatPreview = () => {
  return (
    <div className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Talkify Chat</h3>
          <p className="text-sm text-muted-foreground">Online</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="space-y-4 p-4">
        {messages.map((message, i) => (
          <motion.div
            key={message.id}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={messageVariants}
            className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.isCurrentUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {!message.isCurrentUser && (
                <p className="mb-1 text-xs font-medium">{message.sender}</p>
              )}
              <p className="text-sm">{message.content}</p>
              <p className="mt-1 text-right text-xs opacity-70">{message.time}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="flex items-center gap-2 border-t border-border bg-card/50 p-4 backdrop-blur-sm">
        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ImageIcon className="h-5 w-5" />
        </button>
        <div className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm text-muted-foreground">
          Type a message...
        </div>
        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Smile className="h-5 w-5" />
        </button>
        <button className="rounded-full bg-primary p-2 text-primary-foreground">
          <Send className="h-5 w-5" />
        </button>
      </div>

      {/* Decorative gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent" />
    </div>
  );
}; 