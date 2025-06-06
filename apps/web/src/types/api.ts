export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  status: string;
  last_seen: string | null;
  is_online: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  role: string;
  user?: User;
}

export interface Conversation {
  id: string;
  created_by: string;
  name?: string;
  type: 'direct' | 'group';
  created_at: string;
  updated_at: string;
  last_message?: Message;
  participants: ConversationParticipant[];
  unread_count: number;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender?: User;
  reply_to_id?: string;
  reply_to?: Message;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';
  media_url?: string;
  media_thumbnail_url?: string;
  media_size?: number;
  media_duration?: number;
  created_at: string;
  updated_at: string;
  read_by: string[];
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  reactions?: MessageReaction[];
  is_edited: boolean;
  is_deleted: boolean;
}

export interface CreateMessageInput {
  conversation_id: string;
  group_id?: string;
  content: string;
  type: Message['type'];
  reply_to_id?: string;
  media_url?: string;
  media_thumbnail_url?: string;
  media_size?: number;
  media_duration?: number;
}

export interface CreateConversationInput {
  user_ids: string[];
  name?: string;
}

export interface APIError {
  error: string;
}