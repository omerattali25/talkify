import { useParams, Navigate } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { ChatBox } from '../components/ChatBox';

export const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const { conversations, isLoading } = useChat();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const conversation = conversations.find(conv => conv.id === id);
  
  if (!conversation) {
    return <Navigate to="/chats" replace />;
  }

  return (
    <div className="h-screen">
      <ChatBox conversation={conversation} />
    </div>
  );
}; 