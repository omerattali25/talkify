export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  sender: User;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  url: string;
  type: 'image' | 'file' | 'video';
  name: string;
  size: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  participants: User[];
  messages: Message[];
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  unreadCount: number;
}

export interface AuthResponse {
  user: User;
  token: string;
} 