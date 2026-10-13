import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Subscription } from 'rxjs';
import { WebSocket } from 'ws';
import type { Quote } from '../market-data/market-data.types.js';
import { PriceFeed } from '../market-data/price-feed.service.js';
import type { OrderFilledEvent } from '../messaging/events/order-filled.event.js';
import { OrderEvents } from '../messaging/messaging.constants.js';
import { RabbitMqService } from '../messaging/rabbitmq.service.js';
import { StocksService } from '../stocks/stocks.service.js';

// Same cap as Alpaca's free real-time feed: a page never needs more
export const MAX_SYMBOLS_PER_CONNECTION = 30;
// A client that doesn't answer a ping within this time is dropped
export const HEARTBEAT_MS = 30_000;
// Skip pushes to a client that isn't reading (slow network, frozen tab)
const MAX_BUFFERED_BYTES = 1_000_000;

type Client = {
  symbols: Set<string>;
  // Set after "auth": this connection also gets the user's order events
  userId: string | null;
  alive: boolean;
};

type Reply = { event: string; data: unknown };

/**
 * One WebSocket endpoint (/ws) pushing live data, instead of the browser
 * polling. Messages are JSON: { "event": "...", "data": ... }.
 *
 * Client -> server:
 *   subscribe   { symbols: ["AAPL"] }   live quotes for these stocks
 *   unsubscribe { symbols: ["AAPL"] }
 *   auth        { token: "<JWT>" }      also receive my order fills
 * Server -> client:
 *   quote       { symbol, price, change, ... }   whenever the price changes
 *   order       { orderId, side, price, ... }    one of my orders filled
 *   subscribed / authenticated
 *   exception   { status: "error", message }  a bad request (Nest's format)
 *
 * Quotes come from PriceFeed (published right after the database has the
 * price); order fills from RabbitMQ, broadcast to every API instance so the
 * one holding the user's connection gets it.
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnApplicationBootstrap,
    OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clients = new Map<WebSocket, Client>();
  private quotes?: Subscription;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly priceFeed: PriceFeed,
    private readonly stocksService: StocksService,
    private readonly jwtService: JwtService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.quotes = this.priceFeed.quotes$.subscribe((quote) =>
      this.pushQuote(quote),
    );

    await this.rabbitMq.subscribeBroadcast<OrderFilledEvent>(
      OrderEvents.FILLED,
      (event) => this.pushOrder(event),
    );

    // Detect dead connections (a laptop that went to sleep never says bye):
    // ping everyone; whoever didn't pong since the last round is dropped
    this.heartbeat = setInterval(() => {
      for (const [socket, client] of this.clients) {
        if (!client.alive) {
          socket.terminate();
          continue;
        }
        client.alive = false;
        socket.ping();
      }
    }, HEARTBEAT_MS);
  }

  onModuleDestroy(): void {
    this.quotes?.unsubscribe();
    clearInterval(this.heartbeat);
  }

  handleConnection(socket: WebSocket): void {
    const client: Client = { symbols: new Set(), userId: null, alive: true };
    this.clients.set(socket, client);
    socket.on('pong', () => (client.alive = true));
  }

  handleDisconnect(socket: WebSocket): void {
    // Its subscriptions go with it: nothing to clean up anywhere else
    this.clients.delete(socket);
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() data: unknown,
  ): Promise<Reply> {
    const client = this.client(socket);
    const symbols = await this.knownSymbols(data);

    const total = new Set([...client.symbols, ...symbols]);
    if (total.size > MAX_SYMBOLS_PER_CONNECTION) {
      throw new WsException(
        `At most ${MAX_SYMBOLS_PER_CONNECTION} symbols per connection`,
      );
    }

    for (const symbol of symbols) {
      client.symbols.add(symbol);
      // The latest quote right away, not only at the next change
      const latest = this.priceFeed.latestFor(symbol);
      if (latest) {
        this.send(socket, { event: 'quote', data: latest });
      }
    }

    return { event: 'subscribed', data: { symbols: [...client.symbols] } };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() data: unknown,
  ): Promise<Reply> {
    const client = this.client(socket);
    for (const symbol of await this.knownSymbols(data)) {
      client.symbols.delete(symbol);
    }
    return { event: 'subscribed', data: { symbols: [...client.symbols] } };
  }

  // The same JWT as the REST API. Sent as a message, not in the URL: URLs
  // end up in proxy and server logs.
  @SubscribeMessage('auth')
  async auth(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() data: unknown,
  ): Promise<Reply> {
    const token = (data as { token?: unknown } | null)?.token;
    if (typeof token !== 'string') {
      throw new WsException('auth needs { token }');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      this.client(socket).userId = payload.sub;
      return { event: 'authenticated', data: {} };
    } catch {
      throw new WsException('Invalid or expired token');
    }
  }

  private pushQuote(quote: Quote): void {
    for (const [socket, client] of this.clients) {
      if (client.symbols.has(quote.symbol)) {
        this.send(socket, { event: 'quote', data: quote });
      }
    }
  }

  private pushOrder(event: OrderFilledEvent): void {
    for (const [socket, client] of this.clients) {
      if (client.userId === event.userId) {
        this.send(socket, { event: 'order', data: event });
      }
    }
  }

  private send(socket: WebSocket, message: Reply): void {
    if (
      socket.readyState === WebSocket.OPEN &&
      socket.bufferedAmount < MAX_BUFFERED_BYTES
    ) {
      socket.send(JSON.stringify(message));
    }
  }

  private client(socket: WebSocket): Client {
    const client = this.clients.get(socket);
    if (!client) {
      throw new WsException('Unknown connection');
    }
    return client;
  }

  // { symbols: [...] } -> upper-case symbols we actually list
  private async knownSymbols(data: unknown): Promise<string[]> {
    const raw = (data as { symbols?: unknown } | null)?.symbols;
    if (!Array.isArray(raw) || raw.some((s) => typeof s !== 'string')) {
      throw new WsException('Expected { symbols: string[] }');
    }

    const symbols = [
      ...new Set((raw as string[]).map((s) => s.trim().toUpperCase())),
    ];
    const listed = new Set(
      (await this.stocksService.findAll()).map((s) => s.symbol),
    );
    const unknown = symbols.filter((symbol) => !listed.has(symbol));
    if (unknown.length > 0) {
      throw new WsException(`Unknown symbol(s): ${unknown.join(', ')}`);
    }
    return symbols;
  }
}
