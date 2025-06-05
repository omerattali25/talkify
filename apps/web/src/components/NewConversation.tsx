import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat } from '../contexts/ChatContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Search, Plus, X, Users, MessageSquare } from 'lucide-react';
import type { User } from '../types/api';

interface NewConversationProps {
  onClose: () => void;
}

export const NewConversation = ({ onClose }: NewConversationProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { currentUser } = useChat();

  // Fetch all users
  const { data: users = [], isLoading: isLoadingUsers, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    staleTime: 30000, // Cache for 30 seconds
    retry: 1,
  });

  // Show error if users fetch failed
  if (usersError) {
    toast.error('Failed to load users');
  }

  // Filter out current user and already selected users, and apply search
  const availableUsers = users.filter(user => 
    user.id !== currentUser?.id && 
    !selectedUsers.some(selected => selected.id === user.id) &&
    (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const createConversationMutation = useMutation({
    mutationFn: async (users: User[]) => {
      if (users.length === 0) {
        throw new Error('Please select at least one user');
      }

      const isGroup = users.length > 1;
      return api.createConversation({
        user_ids: users.map(u => u.id),
        name: isGroup && groupName.trim() ? groupName.trim() : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(
        selectedUsers.length === 1 
          ? 'Conversation created successfully' 
          : 'Group chat created successfully'
      );
      onClose();
    },
    onError: (error: Error) => {
      if (error.message.includes('409')) {
        toast.error('A conversation already exists with this user');
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    setIsLoading(true);
    try {
      await createConversationMutation.mutateAsync(selectedUsers);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUsers(prev => [...prev, user]);
  };

  const handleRemoveUser = (user: User) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-[480px] max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">New Conversation</h2>
            {selectedUsers.length > 1 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                Group Chat
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <div
                  key={user.id}
                  className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2"
                >
                  <span>{user.username}</span>
                  <button
                    onClick={() => handleRemoveUser(user)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group Name Input (shown only when multiple users are selected) */}
        {selectedUsers.length > 1 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Search Input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-lg">
          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Loading users...</p>
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <Users className="w-12 h-12 mb-2 text-gray-400" />
              <p className="text-center">No users found</p>
            </div>
          ) : (
            <div className="divide-y">
              {availableUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mr-3 flex items-center justify-center font-medium">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{user.username}</h3>
                      {user.email && (
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectUser(user)}
                      className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateConversation}
            disabled={selectedUsers.length === 0 || isLoading}
            className={`px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors
              ${selectedUsers.length === 0 || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}
            `}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                {selectedUsers.length > 1 ? 'Create Group Chat' : 'Create Chat'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 