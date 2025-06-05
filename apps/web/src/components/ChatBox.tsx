import { useState, useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import type { Message, Conversation } from '../types/api';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { isValidConversation } from '../lib/utils';
import { MoreVertical, UserPlus, UserMinus, Settings } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { toast } from 'sonner';

interface ChatBoxProps {
  conversation: Conversation;
}

export const ChatBox = ({ conversation }: ChatBoxProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const typingTimeoutRef = useRef<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, currentUser, markAsRead, typingUsers, sendTypingIndicator } = useChat();

  // Check if this is a valid conversation
  const isValid = isValidConversation(conversation, currentUser?.id);

  // Debug logging
  console.log('ChatBox Render:', {
    conversation,
    currentUser,
    isValid,
    participants: conversation.participants,
    type: conversation.type,
    hasCurrentUser: conversation.participants?.some(p => p.user_id === currentUser?.id),
    participantsWithUsers: conversation.participants?.filter(p => p.user).length,
    participantsWithRoles: conversation.participants?.filter(p => p.role).length
  });

  // Check if current user is admin or owner
  const currentUserRole = conversation.participants.find(p => p.user_id === currentUser?.id)?.role;
  const canManageParticipants = currentUserRole === 'admin' || currentUserRole === 'owner';

  // Fetch messages for the current conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['messages', conversation.id],
    queryFn: () => api.getMessages(conversation.id),
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled: isValid, // Only fetch messages for valid conversations
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
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.sender_id === currentUser?.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p>{message.content}</p>
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
          <textarea
            value={newMessage}
            onChange={handleTyping}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-gray-300 p-2 focus:outline-none focus:border-blue-500"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
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