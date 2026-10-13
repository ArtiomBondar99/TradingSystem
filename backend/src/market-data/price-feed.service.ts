import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import type { Quote } from './market-data.types.js';

/**
 * In-process stream of price changes. MarketPriceSyncService publishes a
 * quote right after writing it to the database, so the price pushed to the
 * screen is the price an order executes at. The WebSocket gateway listens.
 */
@Injectable()
export class PriceFeed {
  private readonly subject = new Subject<Quote>();
  // The last quote per symbol: a new subscriber gets it at once, without
  // waiting for the next change
  private readonly latest = new Map<string, Quote>();

  readonly quotes$: Observable<Quote> = this.subject.asObservable();

  publish(quote: Quote): void {
    this.latest.set(quote.symbol, quote);
    this.subject.next(quote);
  }

  latestFor(symbol: string): Quote | undefined {
    return this.latest.get(symbol);
  }
}
