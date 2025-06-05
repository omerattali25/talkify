import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import type { Message, ChatRoom } from '../../types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatLayoutProps {
  currentUser: { id: string; name: string };
  rooms: ChatRoom[];
  currentRoom?: ChatRoom;
  onRoomSelect: (roomId: string) => void;
}

export const ChatLayout = ({
  currentUser,
  rooms,
  currentRoom,
  onRoomSelect,
}: ChatLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card lg:relative lg:translate-x-0"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <h2 className="text-lg font-semibold">Chats</h2>
              <button
                onClick={toggleSidebar}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => {
                    onRoomSelect(room.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted ${
                    currentRoom?.id === room.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-medium text-primary">
                      {room.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium">{room.name}</p>
                    {room.lastMessage && (
                      <p className="truncate text-sm text-muted-foreground">
                        {room.lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {currentRoom && (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-medium text-primary">
                    {currentRoom.name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold">{currentRoom.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {currentRoom.participants.length} participants
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {currentRoom ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4">
                {currentRoom.messages?.map((message: Message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isCurrentUser={message.sender.id === currentUser.id}
                  />
                ))}
              </div>
            </div>
            <ChatInput
              onSendMessage={(content, attachments) => {
                console.log('Sending message:', { content, attachments });
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}; 