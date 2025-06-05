import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ChatRoom, User, Message } from '../types';

interface ChatContextType {
  chats: ChatRoom[];
  currentUser: User;
  addChat: (name: string, participants: User[]) => void;
  sendMessage: (chatId: string, content: string) => void;
  deleteChat: (chatId: string) => void;
  archiveChat: (chatId: string) => void;
  getChat: (chatId: string) => ChatRoom | undefined;
  searchChats: (query: string) => ChatRoom[];
  getArchivedChats: () => ChatRoom[];
  getUnreadChats: () => ChatRoom[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Mock current user
const mockCurrentUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date(),
};

// Mock users for conversations
const mockUsers: User[] = [
  mockCurrentUser,
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    createdAt: new Date(),
  },
];

// Initial mock chats
const initialChats: ChatRoom[] = [
  {
    id: '1',
    name: 'Team Project',
    participants: [mockUsers[0], mockUsers[1]],
    messages: [
      {
        id: '1',
        content: "Hey, how's the progress on the new feature?",
        sender: mockUsers[1],
        createdAt: new Date(Date.now() - 3600000),
      },
      {
        id: '2',
        content: "It's coming along well! I've completed the main functionality.",
        sender: mockUsers[0],
        createdAt: new Date(Date.now() - 3500000),
      },
    ],
    lastMessage: {
      id: '2',
      content: "It's coming along well! I've completed the main functionality.",
      sender: mockUsers[0],
      createdAt: new Date(Date.now() - 3500000),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
    unreadCount: 0,
  },
  {
    id: '2',
    name: 'Design Team',
    participants: [mockUsers[0], mockUsers[2], mockUsers[3]],
    messages: [
      {
        id: '1',
        content: 'The new designs look great!',
        sender: mockUsers[2],
        createdAt: new Date(Date.now() - 7200000),
      },
    ],
    lastMessage: {
      id: '1',
      content: 'The new designs look great!',
      sender: mockUsers[2],
      createdAt: new Date(Date.now() - 7200000),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
    unreadCount: 1,
  },
];

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [chats, setChats] = useState<ChatRoom[]>(initialChats);

  const addChat = (name: string, participants: User[]) => {
    const newChat: ChatRoom = {
      id: Date.now().toString(),
      name,
      participants: [...participants, mockCurrentUser],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
      unreadCount: 0,
    };
    setChats((prev) => [newChat, ...prev]);
  };

  const sendMessage = (chatId: string, content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: mockCurrentUser,
      createdAt: new Date(),
    };

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, newMessage],
            lastMessage: newMessage,
            updatedAt: new Date(),
          };
        }
        return chat;
      })
    );
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
  };

  const archiveChat = (chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, isArchived: !chat.isArchived } : chat
      )
    );
  };

  const getChat = (chatId: string) => {
    return chats.find((chat) => chat.id === chatId);
  };

  const searchChats = (query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(lowercaseQuery) ||
        chat.participants.some((p) => p.name.toLowerCase().includes(lowercaseQuery)) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(lowercaseQuery))
    );
  };

  const getArchivedChats = () => chats.filter((chat) => chat.isArchived);
  const getUnreadChats = () => chats.filter((chat) => chat.unreadCount > 0);

  const value = {
    chats,
    currentUser: mockCurrentUser,
    addChat,
    sendMessage,
    deleteChat,
    archiveChat,
    getChat,
    searchChats,
    getArchivedChats,
    getUnreadChats,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 