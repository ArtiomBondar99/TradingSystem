import type { OrderSide } from './types';

// What the backend's RealtimeGateway pushes (backend/src/realtime)
export type LiveQuote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: string;
};

export type OrderFilledEvent = {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: string;
  fee: string;
  executedAt: string;
};

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

type Listeners = {
  quote: Set<(quote: LiveQuote) => void>;
  order: Set<(event: OrderFilledEvent) => void>;
  status: Set<(status: ConnectionStatus) => void>;
};

const MAX_RETRY_MS = 30_000;

/**
 * One WebSocket for the whole app, shared by every component.
 *
 * - Subscriptions are reference-counted: two components showing AAPL share
 *   one server subscription, removed when the last one unmounts.
 * - Reconnects after a drop with exponential backoff (1s, 2s, 4s ... 30s)
 *   plus random jitter, so clients don't all reconnect in the same second
 *   after a server restart. After reconnecting it re-sends auth and every
 *   subscription: the server forgot them with the old connection.
 * - The browser answers the server's heartbeat pings by itself.
 */
class RealtimeClient {
  private socket?: WebSocket;
  private status: ConnectionStatus = 'closed';
  private readonly symbols = new Map<string, number>();
  private token: string | null = null;
  private retry = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private readonly listeners: Listeners = {
    quote: new Set(),
    order: new Set(),
    status: new Set(),
  };

  start(token: string): void {
    this.token = token;
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  /** On logout: close, and don't reconnect */
  stop(): void {
    this.stopped = true;
    this.token = null;
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = undefined;
    this.setStatus('closed');
  }

  /** Live quotes for `symbol` until the returned function is called */
  subscribe(symbol: string): () => void {
    const count = this.symbols.get(symbol) ?? 0;
    this.symbols.set(symbol, count + 1);
    if (count === 0) {
      this.send('subscribe', { symbols: [symbol] });
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (this.symbols.get(symbol) ?? 1) - 1;
      if (left > 0) {
        this.symbols.set(symbol, left);
      } else {
        this.symbols.delete(symbol);
        this.send('unsubscribe', { symbols: [symbol] });
      }
    };
  }

  on<K extends keyof Listeners>(
    event: K,
    listener: Listeners[K] extends Set<infer L> ? L : never,
  ): () => void {
    const set = this.listeners[event] as Set<typeof listener>;
    set.add(listener);
    return () => set.delete(listener);
  }

  private connect(): void {
    this.setStatus('connecting');
    // Same host as the page: in development the Vite proxy forwards /ws
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      this.retry = 0;
      this.setStatus('open');
      if (this.token) {
        this.send('auth', { token: this.token });
      }
      if (this.symbols.size > 0) {
        this.send('subscribe', { symbols: [...this.symbols.keys()] });
      }
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      const { event, data } = JSON.parse(message.data) as {
        event: string;
        data: unknown;
      };
      if (event === 'quote') {
        this.listeners.quote.forEach((fn) => fn(data as LiveQuote));
      } else if (event === 'order') {
        this.listeners.order.forEach((fn) => fn(data as OrderFilledEvent));
      } else if (event === 'exception') {
        console.warn('Realtime:', (data as { message?: string }).message);
      }
    };

    // An error is always followed by close, so close handles both
    socket.onclose = () => {
      if (this.socket !== socket) return; // an old socket, already replaced
      this.socket = undefined;
      if (this.stopped) return;
      this.setStatus('connecting');
      const delay =
        Math.min(MAX_RETRY_MS, 1_000 * 2 ** this.retry) + Math.random() * 500;
      this.retry++;
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private send(event: string, data: unknown): void {
    // Not open: nothing is lost, onopen sends auth and every subscription
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, data }));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.listeners.status.forEach((fn) => fn(status));
  }
}

export const realtime = new RealtimeClient();
