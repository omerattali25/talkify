import { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Paperclip, Send, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: File[]) => void;
  isLoading?: boolean;
}

export const ChatInput = ({ onSendMessage, isLoading }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 flex flex-wrap gap-2 overflow-hidden"
          >
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-sm"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="max-h-32 min-h-[40px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            rows={1}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            disabled={isLoading}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90"
            disabled={isLoading || (!message.trim() && attachments.length === 0)}
          >
            <Send className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}; 