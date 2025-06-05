import { useQuery } from '@tanstack/react-query'
import { MessagesList } from './messages-list'
import { ChatInput } from './chat-input'
import { ChatNav } from './chat-nav'
import { getCurrentUser } from '../../lib/api'

interface ChatLayoutProps {
  conversationId: string
}

export function ChatLayout({ conversationId }: ChatLayoutProps) {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  })

  if (isLoading || !currentUser?.data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <ChatNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessagesList
          conversationId={conversationId}
          currentUserId={currentUser.data.id}
        />
        <ChatInput conversationId={conversationId} />
      </div>
    </div>
  )
} 