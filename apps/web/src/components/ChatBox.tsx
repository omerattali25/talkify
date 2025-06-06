import { useState, useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import type { Message, Conversation, MessageReaction } from '../types/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { isValidConversation } from '../lib/utils';
import { MoreVertical, UserPlus, UserMinus, Settings, Smile, Plus } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface ChatBoxProps {
  conversation: Conversation;
}

export const ChatBox = ({ conversation }: ChatBoxProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionMessage, setReactionMessage] = useState<Message | null>(null);
  const typingTimeoutRef = useRef<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const { sendMessage, currentUser, markAsRead, typingUsers, sendTypingIndicator } = useChat();

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const response = await api.addMessageReaction(messageId, emoji);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add reaction: ' + error.message);
    },
  });

  // Remove reaction mutation
  const removeReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const response = await api.removeMessageReaction(messageId, emoji);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    },
    onError: (error: Error) => {
      toast.error('Failed to remove reaction: ' + error.message);
    },
  });

  const handleReactionClick = (message: Message) => {
    setReactionMessage(message);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = async (emoji: any) => {
    if (reactionMessage) {
      // If we're adding a reaction to a message
      try {
        await addReactionMutation.mutateAsync({
          messageId: reactionMessage.id,
          emoji: emoji.native,
        });
        setReactionMessage(null);
      } catch (error) {
        console.error('Failed to add reaction:', error);
      }
    } else {
      // If we're adding an emoji to the message input
      setNewMessage(prev => prev + emoji.native);
    }
    setShowEmojiPicker(false);
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await removeReactionMutation.mutateAsync({ messageId, emoji });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  // Group reactions by emoji
  const getGroupedReactions = (reactions: MessageReaction[] = []) => {
    return reactions.reduce((acc, reaction) => {
      const existing = acc.find(r => r.emoji === reaction.emoji);
      if (existing) {
        existing.users.push(reaction.user_id);
      } else {
        acc.push({ emoji: reaction.emoji, users: [reaction.user_id] });
      }
      return acc;
    }, [] as { emoji: string; users: string[] }[]);
  };

  // Check if this is a valid conversation
  const isValid = isValidConversation(conversation, currentUser?.id);

  // Debug logging

  // Check if current user is admin or owner
  const currentUserRole = conversation.participants.find(p => p.user_id === currentUser?.id)?.role;
  const canManageParticipants = currentUserRole === 'admin' || currentUserRole === 'owner';

  // Fetch messages for the current conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['messages', conversation.id],
    queryFn: () => api.getMessages(conversation.id),
    staleTime: Infinity, // Never mark data as stale since we update via WebSocket
    gcTime: 1000 * 60 * 60, // Keep unused data for 1 hour
    enabled: isValid, // Only fetch messages for valid conversations
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnReconnect: false // Don't refetch when reconnecting
  });

  // Helper function to get conversation name
  const getConversationName = () => {
    if (!conversation.participants?.length) return 'Unknown';

    if (conversation.type === 'group') {
      return conversation.name || 'Unnamed Group';
    }
    // For direct chats, show the other participant's name
    const otherParticipant = conversation.participants.find(
      p => p.user_id !== currentUser?.id
    )?.user;
    return otherParticipant?.username || 'Unknown User';
  };

  // Helper function to get online status text
  const getOnlineStatus = () => {
    if (!conversation.participants?.length) return '';

    if (conversation.type === 'group') {
      return `${conversation.participants.length} members`;
    }
    const otherParticipant = conversation.participants.find(
      p => p.user_id !== currentUser?.id
    )?.user;
    if (!otherParticipant) return '';
    return otherParticipant.is_online ? 'online' : 'offline';
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark conversation as read when opened
  useEffect(() => {
    const shouldMarkAsRead = isValid && 
      conversation.id && 
      conversation.unread_count > 0 && 
      currentUser?.id && 
      conversation.participants.some(p => p.user_id === currentUser.id) &&
      messages.length > 0; // Only mark as read if we have messages

    let timeoutId: number | undefined;
    
    if (shouldMarkAsRead) {
      timeoutId = window.setTimeout(() => {
        markAsRead(conversation.id);
      }, 1000); // Increased debounce to 1 second
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isValid, conversation.id, conversation.unread_count, currentUser?.id, markAsRead, messages.length]); // Changed messages to messages.length

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    try {
      await sendMessage(conversation.id, newMessage.trim());
      setNewMessage('');
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(conversation.id, false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);

    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(conversation.id, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(conversation.id, false);
    }, 2000);
  };

  const handleAddParticipant = async (userId: string) => {
    try {
      await api.addParticipant(conversation.id, userId);
      // Refetch conversation to update participants list
      // This should be handled by your state management solution
    } catch (error) {
      console.error('Failed to add participant:', error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      await api.removeParticipant(conversation.id, userId);
      // Refetch conversation to update participants list
      // This should be handled by your state management solution
    } catch (error) {
      console.error('Failed to remove participant:', error);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await api.updateParticipantRole(conversation.id, userId, role);
      // Refetch conversation to update participants list
      // This should be handled by your state management solution
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && 
          emojiButtonRef.current && 
          !emojiButtonRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  if (!isValid) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>This conversation is not accessible.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium mr-3">
            {conversation.type === 'group' 
              ? (conversation.name?.[0] || 'G').toUpperCase()
              : conversation.participants.find(p => p.user_id !== currentUser?.id)?.user?.username?.[0].toUpperCase() || '?'
            }
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">{getConversationName()}</h2>
            <div className="text-sm text-gray-500">
              {conversation.participants.length} participants
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.sender_id === currentUser?.id ? 'items-end' : 'items-start'}`}
            >
              <div className="group relative">
                {(conversation.type === 'group' || message.sender_id !== currentUser?.id) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {message.type || 'Unknown User'}
                  </p>
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.sender_id === currentUser?.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.is_deleted ? (
                    <p className="italic text-opacity-70">This message was deleted</p>
                  ) : (
                    <>
                      {message.reply_to && (
                        <div className="mb-1 text-sm opacity-70 border-l-2 pl-2">
                          <p className="font-medium">{message.reply_to.sender_username}</p>
                          <p className="truncate">{message.reply_to.content}</p>
                        </div>
                      )}
                      <p>{message.content}</p>
                      {message.is_edited && (
                        <span className="text-xs opacity-70">(edited)</span>
                      )}
                    </>
                  )}
                  <div className="text-xs opacity-70 mt-1 text-right">
                    {new Date(message.created_at).toLocaleString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                
                {/* Reaction Button */}
                <button
                  onClick={() => handleReactionClick(message)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>

                {/* Reactions Display */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {getGroupedReactions(message.reactions).map(({ emoji, users }) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          if (users.includes(currentUser?.id || '')) {
                            handleRemoveReaction(message.id, emoji);
                          } else {
                            addReactionMutation.mutate({ messageId: message.id, emoji });
                          }
                        }}
                        className={`px-2 py-1 rounded-full text-xs ${
                          users.includes(currentUser?.id || '')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        } hover:bg-blue-200 transition-colors`}
                        title={`${users.length} ${users.length === 1 ? 'reaction' : 'reactions'}`}
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {Object.entries(typingUsers)
        .filter(([conversationId, users]) => 
          conversationId === conversation.id && 
          users.size > 0 &&
          !Array.from(users).includes(currentUser?.id || '')
        )
        .map(([_, users]) => (
          <div key="typing" className="px-4 py-2 text-sm text-gray-500 italic">
            {Array.from(users).join(', ')} {users.size === 1 ? 'is' : 'are'} typing...
          </div>
        ))
      }

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <textarea
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="w-full resize-none rounded-lg border border-gray-300 p-2 pr-10 focus:outline-none focus:border-blue-500"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button
              type="button"
              ref={emojiButtonRef}
              onClick={() => {
                setReactionMessage(null);
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}; 