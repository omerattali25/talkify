import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
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

  // Handle token expiration and invalid token
  useEffect(() => {
    const token = localStorage.getItem('token');
    const publicPaths = ['/login', '/register'];
    const isPublicPath = publicPaths.includes(location.pathname);

    if (!token && !isLoading && !isPublicPath) {
      // If no token and not loading and not on a public path, redirect to login
      navigate('/login');
    }

    if (token && !isLoading && user && isPublicPath) {
      // If we have a token and user but we're on a public path, redirect to chats
      navigate('/chats');
    }
  }, [navigate, isLoading, user, location.pathname]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginInput) => {
      try {
        const response = await api.login(credentials);
        if (!response.token) {
          throw new Error('No token received from server');
        }
        return response;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to login');
      }
    },
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
      // Clear any stale token
      localStorage.removeItem('token');
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      try {
        const response = await api.register(data);
        if (!response.token) {
          throw new Error('No token received from server');
        }
        return response;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to register');
      }
    },
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
      // Clear any stale token
      localStorage.removeItem('token');
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

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local data
      queryClient.clear();
      localStorage.removeItem('token');
      // Navigate to login with full page reload
      window.location.href = '/login';
      toast.success('Logged out successfully');
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