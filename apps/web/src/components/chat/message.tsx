import { cn } from '../../lib/utils'
import { formatDate } from '../../lib/utils'

interface MessageProps {
  message: {
    id: string
    content: string
    createdAt: string
    sender: {
      id: string
      name: string
      avatar?: string
    }
  }
  isCurrentUser: boolean
}

export function Message({ message, isCurrentUser }: MessageProps) {
  return (
    <div
      className={cn(
        'flex w-full gap-2 p-4',
        isCurrentUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {message.sender.avatar ? (
          <img
            src={message.sender.avatar}
            alt={message.sender.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          message.sender.name[0].toUpperCase()
        )}
      </div>
      <div
        className={cn(
          'flex max-w-[75%] flex-col gap-1',
          isCurrentUser ? 'items-end' : 'items-start'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{message.sender.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(message.createdAt)}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm',
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
} 