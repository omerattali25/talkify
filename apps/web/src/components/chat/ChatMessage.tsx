import { motion } from 'framer-motion';
import { format } from 'date-fns';
import type { Message } from '../../types';
import { cn } from '../../lib/utils';

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
}

export const ChatMessage = ({ message, isCurrentUser }: ChatMessageProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex w-full gap-2 p-2',
        isCurrentUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-sm font-medium text-primary">
          {message.sender.name[0].toUpperCase()}
        </span>
      </div>
      
      <div
        className={cn(
          'flex max-w-[70%] flex-col gap-1',
          isCurrentUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-lg px-4 py-2',
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <p className="text-sm">{message.content}</p>
        </div>
        
        <span className="text-xs text-muted-foreground">
          {format(new Date(message.createdAt), 'HH:mm')}
        </span>
      </div>
    </motion.div>
  );
}; 