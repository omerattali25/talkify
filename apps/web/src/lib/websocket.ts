import { toast } from 'sonner';
import type { Message } from '../types/api';

type ChatEvent = 
  | { type: 'new_message'; payload: Message }
  | { type: 'message_updated'; payload: Message }
  | { type: 'message_deleted'; payload: { message_id: string } }
  | { type: 'typing_start'; payload: { conversation_id: string; user_id: string } }
  | { type: 'typing_stop'; payload: { conversation_id: string; user_id: string } }
  | { type: 'message_read'; payload: { conversation_id: string; user_id: string; message_ids: string[] } };

type ChatEventHandler = (event: ChatEvent) => void;

class ChatWebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000; // Start with 1 second
  private eventHandlers: Set<ChatEventHandler> = new Set();

  constructor() {
    this.connect();
  }

  private connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('WebSocket: No token found, skipping connection');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/ws';
    console.log('WebSocket: Attempting to connect to', wsUrl);
    
    try {
      this.socket = new WebSocket(`${wsUrl}?token=${token}`);

      this.socket.onopen = () => {
        console.log('WebSocket: Connected successfully');
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
      };

      this.socket.onmessage = (event) => {
        try {
          const chatEvent = JSON.parse(event.data) as ChatEvent;
          console.log('WebSocket: Received message', chatEvent);
          // Only handle known chat event types
          if (this.isValidChatEvent(chatEvent)) {
            this.eventHandlers.forEach((handler) => handler(chatEvent));
          }
        } catch (error) {
          console.error('WebSocket: Failed to parse message:', error, 'Raw data:', event.data);
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket: Connection closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.handleDisconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket: Error occurred', error);
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('WebSocket: Failed to create connection', error);
      this.handleDisconnect();
    }
  }

  private isValidChatEvent(event: any): event is ChatEvent {
    const isValid = ['new_message', 'message_updated', 'message_deleted', 'typing_start', 'typing_stop', 'message_read'].includes(event.type);
    if (!isValid) {
      console.warn('WebSocket: Received invalid event type', event);
    }
    return isValid;
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff
      console.log(`WebSocket: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectTimeout}ms`);
      setTimeout(() => this.connect(), this.reconnectTimeout);
    } else {
      console.error('WebSocket: Max reconnection attempts reached');
      toast.error('Lost connection to chat. Please refresh the page.');
    }
  }

  public subscribe(handler: ChatEventHandler) {
    console.log('WebSocket: New handler subscribed');
    this.eventHandlers.add(handler);
    return () => {
      console.log('WebSocket: Handler unsubscribed');
      this.eventHandlers.delete(handler);
    };
  }

  public send(event: ChatEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket: Sending event', event);
      this.socket.send(JSON.stringify(event));
    } else {
      console.warn('WebSocket: Cannot send event - connection not open', {
        readyState: this.socket?.readyState,
        event
      });
    }
  }

  public sendTypingStatus(conversationId: string, isTyping: boolean) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'typing',
        payload: {
          conversation_id: conversationId,
          is_typing: isTyping
        }
      }));
    }
  }

  public disconnect() {
    if (this.socket) {
      console.log('WebSocket: Disconnecting');
      this.socket.close();
      this.socket = null;
    }
  }
}

export const chatWs = new ChatWebSocketService(); 