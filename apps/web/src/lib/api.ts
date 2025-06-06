import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
  User,
  LoginInput,
  RegisterInput,
  Conversation,
  Message,
  CreateMessageInput,
  CreateConversationInput,
  APIError,
  AuthResponse,
} from '../types/api';

class APIClient {
  private client: AxiosInstance;
  private static instance: APIClient;

  private constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true // Enable sending cookies
    });

    // Add request interceptor for auth header
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        // Extract user ID from JWT token
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          config.headers['X-User-ID'] = payload.user_id;
        } catch (error) {
          console.error('Failed to parse JWT token:', error);
        }
      }
      return config;
    });

    // Add response interceptor for handling auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<APIError>) => {
        if (error.response?.status === 401) {
          // Clear auth data and redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        // Extract error message from response
        const message = error.response?.data?.error || error.message;
        return Promise.reject(new Error(message));
      }
    );
  }

  public static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  private handleError(error: unknown): never {
    if (error instanceof AxiosError) {
      const message = error.response?.data?.error || error.message;
      throw new Error(message);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }

  // Auth endpoints
  async login(input: LoginInput): Promise<AuthResponse> {
    try {
      const { data } = await this.client.post<AuthResponse>('auth/login', input);
      if (!data.token) {
        throw new Error('No token received from server');
      }
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const { data } = await this.client.post<AuthResponse>('auth/register', input);
      if (!data.token) {
        throw new Error('No token received from server');
      }
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('auth/logout');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const { data } = await this.client.get<User>('users/me');
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      const { data } = await this.client.put<User>('users/me', userData);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.client.put('users/me/password', { currentPassword, newPassword });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUser(id: string): Promise<User> {
    try {
      const { data } = await this.client.get<User>(`users/${id}`);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Conversation endpoints
  async getConversations(): Promise<Conversation[]> {
    try {
      const { data } = await this.client.get<Conversation[]>('conversations');
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getConversation(id: string): Promise<Conversation> {
    try {
      const { data } = await this.client.get<Conversation>(`conversations/${id}`);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    try {
      const { data } = await this.client.post<Conversation>('conversations', input);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Message endpoints
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const { data } = await this.client.get<Message[]>(`messages/conversation/${conversationId}`);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async sendMessage(input: CreateMessageInput): Promise<Message> {
    try {
      const { data } = await this.client.post<Message>('messages', {
        conversation_id: input.conversation_id,
        content: input.content,
        type: input.type,
        reply_to_id: input.reply_to_id,
        media_url: input.media_url,
        media_thumbnail_url: input.media_thumbnail_url,
        media_size: input.media_size,
        media_duration: input.media_duration
      });
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    try {
      await this.client.post(`conversations/${conversationId}/read`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const { data } = await this.client.get<User[]>('users');
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserByUsername(username: string): Promise<User> {
    try {
      const { data } = await this.client.get<User>(`users/search?username=${encodeURIComponent(username)}`);
      return data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Conversation participant management
  async addParticipant(conversationId: string, userId: string): Promise<void> {
    try {
      await this.client.post(`conversations/${conversationId}/participants`, { user_id: userId });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    try {
      await this.client.delete(`conversations/${conversationId}/participants/${userId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateParticipantRole(conversationId: string, userId: string, role: string): Promise<void> {
    try {
      await this.client.put(`conversations/${conversationId}/participants/${userId}/role`, { user_id: userId, role });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Message reaction endpoints
  async addMessageReaction(messageId: string, emoji: string): Promise<void> {
    try {
      await this.client.post(`messages/${messageId}/reactions`, { emoji });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async removeMessageReaction(messageId: string, emoji: string): Promise<void> {
    try {
      await this.client.delete(`messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export const api = APIClient.getInstance();

// Auth
export const login = (username: string, password: string) =>
  api.login({ username, password })

export const register = (email: string, password: string, username: string, phone: string) =>
  api.register({ email, password, username, phone })

export const logout = () => api.logout()

// User Profile
export const getCurrentUser = () => api.getCurrentUser()
export const updateProfile = (data: any) => api.updateProfile(data)
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.changePassword(currentPassword, newPassword)
export const getUser = (id: string) => api.getUser(id)

// Messages
export const getMessages = (conversationId: string) =>
  api.getMessages(conversationId)

export const sendMessage = (conversationId: string, content: string) =>
  api.sendMessage({ conversation_id: conversationId, content, type: 'text' })

// Conversations
export const getConversations = () => api.getConversations()
export const getConversation = (id: string) => api.getConversation(id)

export const createConversation = (input: CreateConversationInput) => api.createConversation(input)

// Users
export const getUsers = () => api.getUsers()
export const getUserByUsername = (username: string) => api.getUserByUsername(username) 

// Conversation participant management
export const addParticipant = (conversationId: string, userId: string) =>
  api.addParticipant(conversationId, userId)

export const removeParticipant = (conversationId: string, userId: string) =>
  api.removeParticipant(conversationId, userId)

export const updateParticipantRole = (conversationId: string, userId: string, role: string) =>
  api.updateParticipantRole(conversationId, userId, role) 