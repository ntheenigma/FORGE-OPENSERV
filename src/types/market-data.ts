export interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookSnapshot {
  timestamp: number;
  bids: [number, number][]; // [price, size]
  asks: [number, number][]; // [price, size]
}

export interface FundingRate {
  timestamp: number;
  rate: number;
  nextFundingTime: number;
}

export interface OpenInterest {
  timestamp: number;
  openInterest: number;
  longRatio: number;
  shortRatio: number;
}

export interface LiquidationEvent {
  timestamp: number;
  side: 'long' | 'short';
  price: number;
  quantity: number;
}

export interface LiquidationLevel {
  price: number;
  cumulativeSize: number;
  side: 'long' | 'short';
}

export interface OptionsIVSurface {
  timestamp: number;
  strikes: number[];
  expirations: string[];
  ivMatrix: number[][]; // [expiration][strike]
  atmIv: number;
}

export interface MarketDataBundle {
  asset: string;
  timestamp: number;
  currentPrice: number;
  priceHistory: PricePoint[];
  ohlcv: OHLCVBar[];
  orderBook?: OrderBookSnapshot;
  fundingRate?: FundingRate;
  openInterest?: OpenInterest;
  recentLiquidations?: LiquidationEvent[];
  liquidationLevels?: LiquidationLevel[];
  ivSurface?: OptionsIVSurface;
}

export type SupportedAsset =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'XAU'
  | 'SPX'
  | 'NVDA'
  | 'TSLA'
  | 'AAPL'
  | 'GOOGL';

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  'BTC', 'ETH', 'SOL', 'XAU', 'SPX', 'NVDA', 'TSLA', 'AAPL', 'GOOGL',
];

export const PYTH_PRICE_FEED_IDS: Record<SupportedAsset, string> = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  XAU: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  SPX: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  NVDA: '0x2af4b2cba205b35c5a41c4506e82a5266d9e24e1ab6a03a12e1e526cc8b8b4f1',
  TSLA: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  GOOGL: '0xe65ff435be2c9b6434e18ca3a3c24a438b9b1441c8e38a02e43e0c0f1a7f4d5b',
};
