// One topic exchange for every domain event. Publishers don't know who
// listens; each consumer binds its own queue to the routing keys it cares about.
export const EVENTS_EXCHANGE = 'trading.events';

// Messages a consumer fails to handle land here instead of being lost or
// retried forever (a "poison message" would otherwise loop endlessly)
export const DEAD_LETTER_EXCHANGE = 'trading.events.dlx';

// Routing keys. Also stored as OutboxEvent.type
export const OrderEvents = {
  FILLED: 'order.filled',
} as const;
