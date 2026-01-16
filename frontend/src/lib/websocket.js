class WebSocketClient {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect(roomId, token) {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Reconnecting to different room');
      }
      
      this.ws = null;
    }

    this.roomId = roomId;
    this.token = token;
    this.reconnectAttempts = 0;

    const wsUrl = `ws://localhost:8000/ws/room/${roomId}/?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('open', { roomId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (error) {
        // Ignore parse errors
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      this.emit('close', { roomId, code: event.code, reason: event.reason });
      
      if (this.roomId === roomId) {
        this.attemptReconnect();
      }
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.roomId && this.token) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      setTimeout(() => {
        this.connect(this.roomId, this.token);
      }, delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts;
      
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      
      this.ws = null;
      this.roomId = null;
      this.token = null;
      this.reconnectAttempts = 0;
    } else {
      this.roomId = null;
      this.token = null;
      this.reconnectAttempts = 0;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  reset() {
    this.disconnect();
    this.listeners.clear();
  }

  // Check if currently connected
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get current connection state
  getState() {
    if (!this.ws) return 'DISCONNECTED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
}

export const wsClient = new WebSocketClient();
