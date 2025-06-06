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
  private reconnectTimer: number | null = null;
  private isConnecting = false;
  private messageQueue: ChatEvent[] = [];
  private pingInterval: number | null = null;
  private pongTimeout: number | null = null;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;

  constructor() {
    this.setupTokenListener();
  }

  private setupTokenListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'token') {
        if (event.newValue) {
          this.connect();
        } else {
          this.disconnect();
        }
      }
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      this.connectionResolve = resolve;
      this.connect();
    });

    return this.connectionPromise;
  }

  private connect() {
    if (this.isConnecting || this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket: Already connected or connecting');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('WebSocket: No token found, skipping connection');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.user_id || !payload.exp) {
        throw new Error('Invalid token payload');
      }

      const expiresIn = payload.exp * 1000 - Date.now();
      if (expiresIn < 0) {
        throw new Error('Token expired');
      }

      if (expiresIn < 5 * 60 * 1000) {
        this.refreshToken();
      }
    } catch (error) {
      console.error('WebSocket: Token validation failed:', error);
      localStorage.removeItem('token');
      window.location.href = '/login';
      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/ws';
    console.log('WebSocket: Attempting to connect to', wsUrl);
    
    try {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }

      this.socket = new WebSocket(`${wsUrl}?token=${token}`);

      this.socket.onopen = () => {
        console.log('WebSocket: Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.startPingPong();

        if (this.connectionResolve) {
          this.connectionResolve();
          this.connectionResolve = null;
          this.connectionPromise = null;
        }

        // Process queued messages
        this.processMessageQueue();
      };

      this.socket.onmessage = (event) => {
        try {
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }

          const data = JSON.parse(event.data);
          
          if (data.type === 'ping') {
            this.socket?.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          if (data.type === 'pong') {
            return;
          }

          const chatEvent = data as ChatEvent;
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
        this.isConnecting = false;
        this.stopPingPong();
        this.socket = null;

        if (event.code === 1000 && event.reason === 'token_expired') {
          console.log('WebSocket: Token expired, attempting to refresh');
          this.refreshToken();
        } else {
          this.handleDisconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket: Error occurred', error);
        this.isConnecting = false;
        this.stopPingPong();
        this.socket = null;
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('WebSocket: Failed to create connection', error);
      this.isConnecting = false;
      this.handleDisconnect();
    }
  }

  private async processMessageQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event) {
        try {
          this.socket.send(JSON.stringify(event));
          // Small delay between messages to prevent flooding
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error('WebSocket: Failed to send queued message:', error);
          // Put the message back in the queue
          this.messageQueue.unshift(event);
          break;
        }
      }
    }
  }

  private startPingPong() {
    this.stopPingPong(); // Clear any existing intervals
    
    this.pingInterval = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping' }));
          
          this.pongTimeout = window.setTimeout(() => {
            console.log('WebSocket: Pong timeout, reconnecting');
            this.reconnect();
          }, 5000);
        } catch (error) {
          console.error('WebSocket: Failed to send ping:', error);
          this.reconnect();
        }
      } else {
        this.reconnect();
      }
    }, 30000);
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private reconnect() {
    this.disconnect();
    setTimeout(() => this.connect(), Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
  }

  private async refreshToken() {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('No token received');
      }

      localStorage.setItem('token', data.token);
      // Reconnect with new token
      this.disconnect();
      this.connect();
    } catch (error) {
      console.error('WebSocket: Failed to refresh token:', error);
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }

  private isValidChatEvent(event: any): event is ChatEvent {
    const validTypes = [
      'new_message',
      'message_updated',
      'message_deleted',
      'typing_start',
      'typing_stop',
      'message_read'
    ];
    const isValid = validTypes.includes(event.type);
    if (!isValid) {
      console.warn('WebSocket: Received invalid event type', event);
    }
    return isValid;
  }

  private handleDisconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff
      console.log(`WebSocket: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectTimeout}ms`);
      this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectTimeout);
    } else {
      console.error('WebSocket: Max reconnection attempts reached');
      toast.error('Lost connection to chat. Please refresh the page.');
    }
  }

  public subscribe(handler: ChatEventHandler) {
    console.log('WebSocket: New handler subscribed');
    this.eventHandlers.add(handler);
    this.connect();
    
    return () => {
      console.log('WebSocket: Handler unsubscribed');
      this.eventHandlers.delete(handler);
      if (this.eventHandlers.size === 0) {
        this.disconnect();
      }
    };
  }

  public async send(event: ChatEvent) {
    try {
      await this.ensureConnected();
      
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        console.log('WebSocket: Connection not ready, queueing message');
        this.messageQueue.push(event);
        return;
      }
      
      console.log('WebSocket: Sending event', event);
      this.socket.send(JSON.stringify(event));
    } catch (error) {
      console.error('WebSocket: Failed to send message:', error);
      this.messageQueue.push(event);
      this.reconnect();
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
    this.stopPingPong();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      console.log('WebSocket: Disconnecting');
      this.socket.close();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
    this.connectionResolve = null;
  }
}

export const chatWs = new ChatWebSocketService(); 