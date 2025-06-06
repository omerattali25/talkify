import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { chatWs } from '../lib/websocket';
import type { User, Conversation, Message, CreateConversationInput } from '../types/api';

interface ChatContextType {
  conversations: Conversation[];
  currentUser: User | undefined;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  createConversation: (input: CreateConversationInput) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  typingUsers: Record<string, Set<string>>;
  sendTypingIndicator: (conversationId: string, isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Record<string, Set<string>>>({});

  // Fetch current user
  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => {
      console.log('ChatContext: Fetching current user');
      return api.getCurrentUser();
    },
  });

  // Handle WebSocket connection/disconnection
  useEffect(() => {
    console.log('ChatContext: Setting up WebSocket cleanup');
    return () => {
      console.log('ChatContext: Cleaning up WebSocket connection');
      chatWs.disconnect();
    };
  }, []);

  // Subscribe to all chat-related WebSocket messages
  useEffect(() => {
    console.log('ChatContext: Setting up WebSocket event subscription');
    const unsubscribe = chatWs.subscribe((event) => {
      console.log('ChatContext: Received WebSocket event', event);
      if (event.type === 'new_message') {
        // Update messages cache
        queryClient.setQueryData(['messages', event.payload.conversation_id], (oldMessages: Message[] | undefined) => {
          if (!oldMessages) return [event.payload];
          return [...oldMessages, event.payload];
        });

        // Update conversations cache
        queryClient.setQueryData(['conversations'], (oldConversations: Conversation[] | undefined) => {
          if (!oldConversations) return oldConversations;
          return oldConversations.map(conv => {
            if (conv.id === event.payload.conversation_id) {
              return {
                ...conv,
                last_message: event.payload,
                unread_count: conv.unread_count + (event.payload.sender_id !== currentUser?.id ? 1 : 0)
              };
            }
            return conv;
          });
        });
      } else if (event.type === 'message_updated') {
        // Update message in cache
        queryClient.setQueryData(['messages', event.payload.conversation_id], (oldMessages: Message[] | undefined) => {
          if (!oldMessages) return oldMessages;
          return oldMessages.map(msg => 
            msg.id === event.payload.id ? event.payload : msg
          );
        });
      } else if (event.type === 'message_read') {
        // Update messages read status
        const conversation = queryClient.getQueryData<Conversation[]>(['conversations'])?.find(
          c => c.id === event.payload.conversation_id
        );
        
        if (conversation) {
          console.log('ChatContext: Processing message_read event', {
            conversation,
            payload: event.payload,
            currentUser
          });

          // Update messages in the cache
          queryClient.setQueryData(['messages', event.payload.conversation_id], (oldMessages: Message[] | undefined) => {
            if (!oldMessages) return oldMessages;
            
            return oldMessages.map(msg => {
              // Only update messages that were sent by the current user and read by someone else
              if (msg.sender_id === currentUser?.id && event.payload.message_ids.includes(msg.id)) {
                const newReadBy = [...new Set([...msg.read_by, event.payload.user_id])];
                const allParticipantsExceptSender = conversation.participants.filter(p => p.user_id !== currentUser.id);
                const allOtherParticipantsRead = allParticipantsExceptSender.every(p => 
                  newReadBy.includes(p.user_id)
                );

                return {
                  ...msg,
                  read_by: newReadBy,
                  status: allOtherParticipantsRead ? 'read' : 'delivered'
                };
              }
              return msg;
            });
          });

          // Update conversation unread count
          queryClient.setQueryData(['conversations'], (oldConversations: Conversation[] | undefined) => {
            if (!oldConversations) return oldConversations;
            return oldConversations.map(conv => {
              if (conv.id === event.payload.conversation_id) {
                // Only update unread count for the user who read the messages
                return { 
                  ...conv, 
                  unread_count: event.payload.user_id === currentUser?.id ? 0 : conv.unread_count 
                };
              }
              return conv;
            });
          });
        }
      } else if (event.type === 'typing_start') {
        console.log('ChatContext: Handling typing start event');
        setTypingUsers(prev => {
          const conversationTypers = prev[event.payload.conversation_id] || new Set();
          conversationTypers.add(event.payload.user_id);
          return { ...prev, [event.payload.conversation_id]: conversationTypers };
        });
      } else if (event.type === 'typing_stop') {
        console.log('ChatContext: Handling typing stop event');
        setTypingUsers(prev => {
          const conversationTypers = prev[event.payload.conversation_id] || new Set();
          conversationTypers.delete(event.payload.user_id);
          return { ...prev, [event.payload.conversation_id]: conversationTypers };
        });
      }
    });

    return () => {
      console.log('ChatContext: Cleaning up WebSocket event subscription');
      unsubscribe();
    };
  }, [queryClient, currentUser?.id]);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations, error: conversationsError } = useQuery<Conversation[], Error>({
    queryKey: ['conversations'],
    queryFn: async () => {
      console.log('ChatContext: Fetching conversations');
      const data = await api.getConversations();
      console.log('ChatContext: Successfully fetched conversations', data);
      return data;
    },
    enabled: !!currentUser,
    retry: false,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5 // 5 minutes
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (params: { conversationId: string; content: string }) => {
      console.log('ChatContext: Sending message', params);
      return api.sendMessage({ conversation_id: params.conversationId, content: params.content, type: 'text' });
    },
    onSuccess: () => {
      console.log('ChatContext: Message sent successfully');
      queryClient.invalidateQueries({ queryKey: ['conversations'] as const });
      queryClient.invalidateQueries({ queryKey: ['messages'] as const });
    },
    onError: (error: Error) => {
      console.error('ChatContext: Failed to send message', error);
    }
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (input: CreateConversationInput) => {
      console.log('ChatContext: Creating conversation', input);
      return api.createConversation(input);
    },
    onSuccess: () => {
      console.log('ChatContext: Conversation created successfully');
      queryClient.invalidateQueries({ queryKey: ['conversations'] as const });
    },
    onError: (error: Error) => {
      console.error('ChatContext: Failed to create conversation', error);
    }
  });

  // Mark conversation as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: string) => {
      console.log('ChatContext: Marking conversation as read', conversationId);
      return api.markConversationAsRead(conversationId);
    },
    onMutate: async (conversationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });

      // Snapshot the previous values
      const previousConversations = queryClient.getQueryData<Conversation[]>(['conversations']);
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', conversationId]);

      // Optimistically update conversations
      if (previousConversations) {
        queryClient.setQueryData(['conversations'], previousConversations.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, unread_count: 0 };
          }
          return conv;
        }));
      }

      // Optimistically update messages
      if (previousMessages && currentUser?.id) {
        const conversation = previousConversations?.find(c => c.id === conversationId);
        if (conversation) {
          queryClient.setQueryData(['messages', conversationId], previousMessages.map(msg => {
            if (!msg.read_by.includes(currentUser.id)) {
              return {
                ...msg,
                read_by: [...msg.read_by, currentUser.id],
                status: msg.read_by.length + 1 === conversation.participants.length ? 'read' : 'delivered'
              };
            }
            return msg;
          }));
        }
      }

      return { previousConversations, previousMessages };
    },
    onError: (err, conversationId, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations);
      }
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', conversationId], context.previousMessages);
      }
      console.error('ChatContext: Failed to mark conversation as read', err);
    },
    onSettled: (_, __, conversationId) => {
      // Only invalidate the specific conversation and its messages
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    }
  });

  const sendTypingIndicator = (conversationId: string, isTyping: boolean) => {
    if (!currentUser?.id) {
      console.warn('ChatContext: Cannot send typing indicator - no current user');
      return;
    }
    console.log('ChatContext: Sending typing indicator', { conversationId, isTyping });
    chatWs.send({
      type: isTyping ? 'typing_start' : 'typing_stop',
      payload: { conversation_id: conversationId, user_id: currentUser.id }
    });
  };

  const value: ChatContextType = {
    conversations,
    currentUser,
    isLoading: isLoadingUser || isLoadingConversations,
    error: userError || conversationsError,
    sendMessage: async (conversationId: string, content: string) => {
      await sendMessageMutation.mutateAsync({ conversationId, content });
    },
    createConversation: async (input: CreateConversationInput) => {
      await createConversationMutation.mutateAsync(input);
    },
    markAsRead: async (conversationId: string) => {
      await markAsReadMutation.mutateAsync(conversationId);
    },
    typingUsers,
    sendTypingIndicator,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 