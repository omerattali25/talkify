import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { User, LoginInput, RegisterInput } from '../types/api';

interface AuthContextType {
  user: User | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current user
  const {
    data: user,
    isLoading,
    error,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    retry: false,
    enabled: !!localStorage.getItem('token'), // Only fetch if token exists
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginInput) => api.login(credentials),
    onSuccess: async (response) => {
      // Store token
      localStorage.setItem('token', response.token);
      // Refetch user data
      await refetchUser();
      // Navigate to chats
      navigate('/chats');
      toast.success('Welcome back!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to login');
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: async (response) => {
      // Store token
      localStorage.setItem('token', response.token);
      // Refetch user data
      await refetchUser();
      // Navigate to chats
      navigate('/chats');
      toast.success('Welcome to Talkify!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to register');
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['currentUser'], updatedUser);
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  // Handle token expiration and invalid token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && !isLoading) {
      // If no token and not loading, redirect to login
      navigate('/login');
    }
  }, [navigate, isLoading]);

  const handleLogout = async () => {
    try {
      await api.logout();
      // Clear all query cache
      queryClient.clear();
      // Remove token
      localStorage.removeItem('token');
      // Navigate to login
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local data even if API call fails
      queryClient.clear();
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: error as Error | null,
    login: async (credentials: LoginInput) => {
      await loginMutation.mutateAsync(credentials);
    },
    register: async (data: RegisterInput) => {
      await registerMutation.mutateAsync(data);
    },
    logout: handleLogout,
    updateProfile: async (data: Partial<User>) => {
      await updateProfileMutation.mutateAsync(data);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 