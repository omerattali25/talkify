import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { CreateMessageInput, CreateConversationInput, User } from '../types/api';

// Auth hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login.bind(api),
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.register.bind(api),
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout.bind(api),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// User hooks
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile.bind(api),
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) =>
      api.changePassword(params.currentPassword, params.newPassword),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => api.getUser(id),
    enabled: !!id,
  });
}

// Conversation hooks
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
    retry: (failureCount, error) => {
      // Don't retry for 403s (forbidden) or 401s (unauthorized)
      if (error instanceof Error && (error.message.includes('403') || error.message.includes('401'))) {
        return false;
      }
      // Only retry once for 404s (conversation might not be loaded yet)
      if (error instanceof Error && error.message.includes('404')) {
        return failureCount < 1;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConversationInput) => api.createConversation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Message hooks
export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.getMessages(conversationId),
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMessageInput) => api.sendMessage(input),
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['messages', message.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.markConversationAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
} 