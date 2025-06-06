import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { ChatBox } from './ChatBox';
import { NewConversation } from './NewConversation';
import type { Conversation } from '../types/api';
import { MessageSquare, Search, Plus, Settings } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { isValidConversation } from '../lib/utils';

export const Chat = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { conversations, currentUser, isLoading: isLoadingContext, error: contextError } = useChat();
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to get conversation display name
  const getConversationName = (conversation: Conversation) => {
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

  // Helper function to get conversation avatar
  const getConversationAvatar = (conversation: Conversation) => {
    if (!conversation.participants?.length) {
      return (
        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 mr-3 flex items-center justify-center font-medium">
          ?
        </div>
      );
    }

    if (conversation.type === 'group') {
      return (
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mr-3 flex items-center justify-center font-medium">
          {conversation.name ? conversation.name[0].toUpperCase() : 'G'}
        </div>
      );
    }
    const otherParticipant = conversation.participants.find(
      p => p.user_id !== currentUser?.id
    )?.user;
    return (
      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mr-3 flex items-center justify-center font-medium">
        {otherParticipant?.username?.[0].toUpperCase() || '?'}
      </div>
    );
  };

  // Fetch the conversation if accessed directly via URL
  const { data: directConversation, isLoading: isLoadingDirect, error: directError } = useQuery<Conversation>({
    queryKey: ['conversation', id],
    queryFn: () => api.getConversation(id!),
    enabled: !!id,
    retry: false
  });

  // Update conversations cache when direct conversation is fetched
  useEffect(() => {
    if (directConversation) {
      const existingConversations = queryClient.getQueryData<Conversation[]>(['conversations']) || [];
      const conversationExists = existingConversations.some(c => c.id === directConversation.id);
      
      if (!conversationExists) {
        queryClient.setQueryData(['conversations'], [...existingConversations, directConversation]);
      }
    }
  }, [directConversation, queryClient]);

  const isLoading = isLoadingContext || isLoadingDirect;
  const error = contextError || directError;
  
  // Use the conversation from the list if available, otherwise use the directly fetched one
  const selectedConversation = id ? (conversations.find(conv => conv.id === id) || directConversation) : null;

  // Validate conversation access only when a specific conversation is selected
  const isValid = !id || (selectedConversation && isValidConversation(selectedConversation, currentUser?.id));

  // Filter conversations based on search query
  const filteredConversations = searchQuery
    ? conversations.filter(conv =>
        conv.participants?.some(p =>
          p.user?.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : conversations;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        <p>Error loading conversation: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  // Only show the access error if we're trying to view a specific conversation
  if (id && !isValid) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        <p>You don't have access to this conversation or it doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 w-full">
      {/* Conversation List */}
      <div className="w-80 border-r bg-white flex flex-col flex-shrink-0">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowNewConversation(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-400" />
              {searchQuery ? (
                <>
                  <p className="text-center mb-2">No conversations found</p>
                  <p className="text-sm text-center text-gray-400">
                    Try a different search term
                  </p>
                </>
              ) : (
                <>
                  <p className="text-center mb-2">No conversations yet</p>
                  <button
                    onClick={() => setShowNewConversation(true)}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    Start a new conversation
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isValid = isValidConversation(conversation, currentUser?.id);

              return (
                <button
                  key={conversation.id}
                  onClick={(e) => {
                    e.preventDefault();
                    if (isValid) {
                      navigate(`/chats/${conversation.id}`);
                    }
                  }}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                  } ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    {getConversationAvatar(conversation)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 truncate">
                          {getConversationName(conversation)}
                        </h3>
                        {conversation.last_message && (
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(conversation.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          {conversation.type === 'direct' && isValid && (
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                conversation.participants.find(p => p.user_id !== currentUser?.id)?.user?.is_online
                                  ? 'bg-green-500'
                                  : 'bg-gray-300'
                              }`}
                            />
                          )}
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.last_message ? (
                              <>
                                {conversation.type === 'group' && conversation.last_message.sender?.username && (
                                  <span className="font-medium text-gray-700 mr-1">
                                    {conversation.last_message.sender.username}:
                                  </span>
                                )}
                                {conversation.last_message.content}
                              </>
                            ) : (
                              <span className="italic text-gray-400">No messages yet</span>
                            )}
                          </p>
                        </div>
                        {conversation.unread_count > 0 && isValid && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full min-w-[1.25rem] text-center">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {selectedConversation && isValidConversation(selectedConversation, currentUser?.id) ? (
          <ChatBox conversation={selectedConversation} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <MessageSquare className="w-16 h-16 mb-4 text-gray-400" />
            <h3 className="text-xl font-medium mb-2">Welcome to Talkify</h3>
            <p className="text-gray-400 mb-4">Select a conversation to start chatting</p>
            <button
              onClick={() => setShowNewConversation(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Start a new conversation
            </button>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <NewConversation onClose={() => setShowNewConversation(false)} />
      )}
    </div>
  );
}; 