import axios from 'axios';
import { config } from '../config';
import {
  PricePoint,
  OHLCVBar,
  FundingRate,
  OpenInterest,
  LiquidationLevel,
  OptionsIVSurface,
  MarketDataBundle,
  SupportedAsset,
  PYTH_PRICE_FEED_IDS,
} from '../types/market-data';

/**
 * Fetch current price from Pyth Hermes API.
 */
export async function fetchPythPrice(asset: SupportedAsset): Promise<PricePoint> {
  const feedId = PYTH_PRICE_FEED_IDS[asset];
  const url = `${config.marketData.pythHermesUrl}/v2/updates/price/latest`;
  const response = await axios.get(url, { params: { ids: [feedId] } });

  const priceData = response.data.parsed?.[0]?.price;
  if (!priceData) {
    throw new Error(`No price data returned for ${asset}`);
  }

  const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
  return {
    timestamp: Date.now(),
    price,
  };
}

/**
 * Fetch historical prices from Pyth for backtesting/validation.
 */
export async function fetchPythHistoricalPrice(
  asset: SupportedAsset,
  timestampUnix: number
): Promise<PricePoint> {
  const feedId = PYTH_PRICE_FEED_IDS[asset];
  const url = `${config.marketData.pythHermesUrl}/v2/updates/price/${timestampUnix}`;
  const response = await axios.get(url, { params: { ids: [feedId] } });

  const priceData = response.data.parsed?.[0]?.price;
  if (!priceData) {
    throw new Error(`No historical price data for ${asset} at ${timestampUnix}`);
  }

  const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
  return { timestamp: timestampUnix * 1000, price };
}

/**
 * Fetch OHLCV data from Deribit (crypto assets only).
 */
export async function fetchDeribitOHLCV(
  asset: 'BTC' | 'ETH' | 'SOL',
  resolution: number = 60, // minutes
  count: number = 500
): Promise<OHLCVBar[]> {
  const instrument = `${asset}-PERPETUAL`;
  const endTimestamp = Date.now();
  const startTimestamp = endTimestamp - count * resolution * 60 * 1000;

  const response = await axios.get(
    `${config.marketData.deribitApiUrl}/public/get_tradingview_chart_data`,
    {
      params: {
        instrument_name: instrument,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        resolution: String(resolution),
      },
    }
  );

  const data = response.data.result;
  if (!data || !data.ticks) return [];

  return data.ticks.map((tick: number, i: number) => ({
    timestamp: tick,
    open: data.open[i],
    high: data.high[i],
    low: data.low[i],
    close: data.close[i],
    volume: data.volume[i],
  }));
}

/**
 * Fetch funding rate from Deribit.
 */
export async function fetchDeribitFunding(asset: 'BTC' | 'ETH' | 'SOL'): Promise<FundingRate> {
  const instrument = `${asset}-PERPETUAL`;
  const response = await axios.get(
    `${config.marketData.deribitApiUrl}/public/get_funding_rate_value`,
    {
      params: {
        instrument_name: instrument,
        start_timestamp: Date.now() - 8 * 60 * 60 * 1000,
        end_timestamp: Date.now(),
      },
    }
  );

  return {
    timestamp: Date.now(),
    rate: response.data.result || 0,
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
  };
}

/**
 * Fetch open interest from CoinGlass.
 */
export async function fetchCoinglassOpenInterest(asset: SupportedAsset): Promise<OpenInterest> {
  const response = await axios.get(
    `${config.marketData.coinglassApiUrl}/api/futures/openInterest/chart`,
    {
      params: { symbol: asset, interval: '1h' },
      headers: { coinglassSecret: config.marketData.coinglassApiKey },
    }
  );

  const data = response.data.data;
  const latest = Array.isArray(data) ? data[data.length - 1] : null;

  return {
    timestamp: Date.now(),
    openInterest: latest?.openInterest ?? 0,
    longRatio: latest?.longRate ?? 0.5,
    shortRatio: latest?.shortRate ?? 0.5,
  };
}

/**
 * Fetch liquidation levels from CoinGlass.
 */
export async function fetchCoinglassLiquidations(asset: SupportedAsset): Promise<LiquidationLevel[]> {
  const response = await axios.get(
    `${config.marketData.coinglassApiUrl}/api/futures/liquidation/chart`,
    {
      params: { symbol: asset },
      headers: { coinglassSecret: config.marketData.coinglassApiKey },
    }
  );

  const data = response.data.data;
  if (!Array.isArray(data)) return [];

  return data.map((level: any) => ({
    price: level.price,
    cumulativeSize: level.cumulativeSize ?? level.vol ?? 0,
    side: level.side === 'buy' ? 'long' as const : 'short' as const,
  }));
}

/**
 * Fetch options implied volatility surface from Deribit.
 */
export async function fetchDeribitIVSurface(asset: 'BTC' | 'ETH'): Promise<OptionsIVSurface> {
  const response = await axios.get(
    `${config.marketData.deribitApiUrl}/public/get_book_summary_by_currency`,
    {
      params: { currency: asset, kind: 'option' },
    }
  );

  const options = response.data.result || [];
  const strikesSet = new Set<number>();
  const expirationsSet = new Set<string>();

  for (const opt of options) {
    const parts = opt.instrument_name.split('-');
    if (parts.length >= 3) {
      expirationsSet.add(parts[1]);
      strikesSet.add(parseFloat(parts[2]));
    }
  }

  const strikes = Array.from(strikesSet).sort((a, b) => a - b);
  const expirations = Array.from(expirationsSet).sort();

  // Build IV matrix
  const ivMatrix: number[][] = expirations.map(() => strikes.map(() => 0));
  let atmIvSum = 0;
  let atmCount = 0;

  for (const opt of options) {
    const parts = opt.instrument_name.split('-');
    if (parts.length < 3) continue;
    const exp = parts[1];
    const strike = parseFloat(parts[2]);
    const ei = expirations.indexOf(exp);
    const si = strikes.indexOf(strike);
    if (ei >= 0 && si >= 0 && opt.mark_iv) {
      ivMatrix[ei][si] = opt.mark_iv / 100;
      if (Math.abs(strike - opt.underlying_price) / opt.underlying_price < 0.02) {
        atmIvSum += opt.mark_iv / 100;
        atmCount++;
      }
    }
  }

  return {
    timestamp: Date.now(),
    strikes,
    expirations,
    ivMatrix,
    atmIv: atmCount > 0 ? atmIvSum / atmCount : 0,
  };
}

/**
 * Aggregate all available market data for an asset into a bundle.
 */
export async function fetchMarketDataBundle(asset: SupportedAsset): Promise<MarketDataBundle> {
  const currentPricePromise = fetchPythPrice(asset);
  const isCrypto = ['BTC', 'ETH', 'SOL'].includes(asset);
  const hasOptions = ['BTC', 'ETH'].includes(asset);

  const promises: Promise<any>[] = [currentPricePromise];

  if (isCrypto) {
    promises.push(
      fetchDeribitOHLCV(asset as 'BTC' | 'ETH' | 'SOL').catch(() => []),
      fetchDeribitFunding(asset as 'BTC' | 'ETH' | 'SOL').catch(() => null),
      fetchCoinglassOpenInterest(asset).catch(() => null),
      fetchCoinglassLiquidations(asset).catch(() => []),
    );
  }

  if (hasOptions) {
    promises.push(
      fetchDeribitIVSurface(asset as 'BTC' | 'ETH').catch(() => null),
    );
  }

  const results = await Promise.all(promises);

  const currentPrice = results[0] as PricePoint;
  const ohlcv = isCrypto ? (results[1] as OHLCVBar[]) : [];
  const funding = isCrypto ? (results[2] as FundingRate | null) : undefined;
  const oi = isCrypto ? (results[3] as OpenInterest | null) : undefined;
  const liquidations = isCrypto ? (results[4] as LiquidationLevel[]) : undefined;
  const ivSurface = hasOptions ? (results[isCrypto ? 5 : 1] as OptionsIVSurface | null) : undefined;

  return {
    asset,
    timestamp: Date.now(),
    currentPrice: currentPrice.price,
    priceHistory: [currentPrice],
    ohlcv,
    fundingRate: funding ?? undefined,
    openInterest: oi ?? undefined,
    liquidationLevels: liquidations,
    ivSurface: ivSurface ?? undefined,
  };
}
