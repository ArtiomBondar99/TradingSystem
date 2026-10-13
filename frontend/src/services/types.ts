// Shapes of the backend's JSON responses (see backend/src/**/dto).
// Money is always a string such as "1900.00": the backend does the math with
// Decimal, and the frontend only formats it for display.

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  firstName: string;
  lastName: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

export type Stock = {
  symbol: string;
  name: string;
  currentPrice: string;
  updatedAt: string;
};

export type Position = {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string;
  marketValue: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
};

export type Portfolio = {
  cashBalance: string;
  positionsValue: string;
  totalValue: string;
  unrealizedPnL: string;
  positions: Position[];
};

// Every error response has this shape (backend AllExceptionsFilter)
export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  // Only for validation errors: one entry per invalid field
  errors?: string[];
  requestId: string;
};
