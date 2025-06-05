import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Message } from '../../components/chat/message'
import { getMessages } from '../../lib/api'

interface Message {
  id: string
  content: string
  createdAt: string
  sender: {
    id: string
    name: string
    avatar?: string
  }
}

interface MessagesListProps {
  conversationId: string
  currentUserId: string
}

export function MessagesList({ conversationId, currentUserId }: MessagesListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
    refetchInterval: 3000, // Poll every 3 seconds
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {messages?.data.map((message: Message) => (
        <Message
          key={message.id}
          message={message}
          isCurrentUser={message.sender.id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
} 