// The stocks users can trade. prisma/seed.ts inserts them into the database,
// and the simulated market-data provider uses basePrice as the level its
// generated prices move around. Prices are approximate, not live quotes.
export const STOCK_UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: '190.00' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', basePrice: '420.00' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', basePrice: '250.00' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', basePrice: '120.00' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: '170.00' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', basePrice: '185.00' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', basePrice: '500.00' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', basePrice: '650.00' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', basePrice: '160.00' },
  { symbol: 'INTC', name: 'Intel Corporation', basePrice: '30.00' },
  { symbol: 'ORCL', name: 'Oracle Corporation', basePrice: '140.00' },
  { symbol: 'CRM', name: 'Salesforce, Inc.', basePrice: '270.00' },
  { symbol: 'ADBE', name: 'Adobe Inc.', basePrice: '500.00' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.', basePrice: '70.00' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', basePrice: '200.00' },
  { symbol: 'V', name: 'Visa Inc.', basePrice: '275.00' },
  { symbol: 'MA', name: 'Mastercard Incorporated', basePrice: '460.00' },
  { symbol: 'WMT', name: 'Walmart Inc.', basePrice: '70.00' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', basePrice: '850.00' },
  { symbol: 'KO', name: 'The Coca-Cola Company', basePrice: '62.00' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', basePrice: '170.00' },
  { symbol: 'DIS', name: 'The Walt Disney Company', basePrice: '100.00' },
  { symbol: 'NKE', name: 'NIKE, Inc.', basePrice: '90.00' },
  { symbol: 'BA', name: 'The Boeing Company', basePrice: '180.00' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', basePrice: '115.00' },
] as const;

export type UniverseStock = (typeof STOCK_UNIVERSE)[number];
