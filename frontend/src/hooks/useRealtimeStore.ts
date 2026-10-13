import { create } from 'zustand';
import type { ConnectionStatus, OrderFilledEvent } from '../services/realtime';

type RealtimeState = {
  status: ConnectionStatus;
  // When the last live quote arrived, per symbol (ms): for stale detection
  lastQuoteAt: Record<string, number>;
  // Fills to show as toasts
  fills: OrderFilledEvent[];
  // Fills the order form already showed: no pop-up for those
  seenFills: Set<string>;
  setStatus: (status: ConnectionStatus) => void;
  quoteArrived: (symbol: string) => void;
  addFill: (fill: OrderFilledEvent) => void;
  dismissFill: (orderId: string) => void;
  markFillSeen: (orderId: string) => void;
};

// Client state about the live connection (not persisted: it's about now)
export const useRealtimeStore = create<RealtimeState>()((set) => ({
  status: 'closed',
  lastQuoteAt: {},
  fills: [],
  seenFills: new Set(),
  setStatus: (status) => set({ status }),
  quoteArrived: (symbol) =>
    set((state) => ({
      lastQuoteAt: { ...state.lastQuoteAt, [symbol]: Date.now() },
    })),
  addFill: (fill) =>
    set((state) =>
      state.seenFills.has(fill.orderId)
        ? state
        : { fills: [...state.fills, fill] },
    ),
  dismissFill: (orderId) =>
    set((state) => ({
      fills: state.fills.filter((fill) => fill.orderId !== orderId),
    })),
  // The HTTP response comes back before the push (which waits for the
  // outbox relay), so the form can claim its fill first
  markFillSeen: (orderId) =>
    set((state) => ({ seenFills: new Set(state.seenFills).add(orderId) })),
}));

/** Is the live connection up? Polling can slow down while it is. */
export const useIsLive = () =>
  useRealtimeStore((state) => state.status === 'open');
