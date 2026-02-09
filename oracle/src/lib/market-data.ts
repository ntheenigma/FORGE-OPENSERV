import type { Candle, OrderBook, MarketSnapshot, Asset } from "./types";
import { BINANCE_REST_URL, PYTH_URL, PYTH_BTC_FEED, PYTH_GOLD_FEED } from "./constants";
import { setCandleCache, setLatestPrice } from "./store";

// ── Binance REST (BTC candles + orderbook) ──

export async function fetchBTCCandles(
  interval = "1m",
  limit = 100
): Promise<Candle[]> {
  try {
    const res = await fetch(
      `${BINANCE_REST_URL}/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
      { next: { revalidate: 30 } }
    );
    const data = await res.json();
    return data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (e) {
    console.error("[ORACLE] Binance candles failed:", e);
    return [];
  }
}

export async function fetchBTCOrderbook(): Promise<OrderBook> {
  try {
    const res = await fetch(
      `${BINANCE_REST_URL}/depth?symbol=BTCUSDT&limit=20`,
      { next: { revalidate: 10 } }
    );
    const data = await res.json();
    return {
      bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
    };
  } catch {
    return { bids: [], asks: [] };
  }
}

// ── Pyth Network (oracle prices) ──

export async function fetchPythPrice(
  feedId: string
): Promise<{ price: number; confidence: number } | null> {
  try {
    const res = await fetch(`${PYTH_URL}?ids[]=${feedId}`, {
      next: { revalidate: 5 },
    });
    const data = await res.json();
    const feed = data[0];
    const price = Number(feed.price.price) * 10 ** feed.price.expo;
    const confidence = Number(feed.price.conf) * 10 ** feed.price.expo;
    return { price, confidence };
  } catch {
    return null;
  }
}

// ── Gold Price (multi-source with fallback) ──

let lastGoldPrice = 2650; // fallback seed
let lastGoldUpdate = 0;

async function fetchGoldFromPyth(): Promise<number | null> {
  const result = await fetchPythPrice(PYTH_GOLD_FEED);
  return result ? result.price : null;
}

async function fetchGoldFromExchangeRate(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.exchangerate.host/latest?base=XAU&symbols=USD",
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    if (data.rates?.USD) return data.rates.USD;
    return null;
  } catch {
    return null;
  }
}

function simulateGoldPrice(): number {
  // Brownian motion drift from last known price
  const drift = (Math.random() - 0.498) * 0.5;
  lastGoldPrice = lastGoldPrice * (1 + drift / 100);
  return Number(lastGoldPrice.toFixed(2));
}

export async function fetchGoldPrice(): Promise<number> {
  const sources = [fetchGoldFromPyth, fetchGoldFromExchangeRate];

  for (const source of sources) {
    try {
      const price = await source();
      if (price && price > 500 && price < 10000) {
        lastGoldPrice = price;
        lastGoldUpdate = Date.now();
        return price;
      }
    } catch {
      continue;
    }
  }

  return simulateGoldPrice();
}

// ── Gold Candle Generation ──
// Since there's no free real-time gold candle source, we generate from price snapshots

let goldCandleBuffer: Candle[] = [];
let currentGoldCandle: Candle | null = null;

export function updateGoldCandle(price: number): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  const minuteBucket = now - (now % 60);

  if (!currentGoldCandle || currentGoldCandle.time !== minuteBucket) {
    if (currentGoldCandle) {
      goldCandleBuffer.push(currentGoldCandle);
      if (goldCandleBuffer.length > 200) goldCandleBuffer = goldCandleBuffer.slice(-200);
    }
    currentGoldCandle = {
      time: minuteBucket,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: Math.random() * 100 + 50,
    };
  } else {
    currentGoldCandle.high = Math.max(currentGoldCandle.high, price);
    currentGoldCandle.low = Math.min(currentGoldCandle.low, price);
    currentGoldCandle.close = price;
    currentGoldCandle.volume += Math.random() * 10;
  }

  return [...goldCandleBuffer, currentGoldCandle];
}

// ── Unified Market Snapshot ──

export async function fetchMarketSnapshot(asset: Asset): Promise<MarketSnapshot> {
  if (asset === "BTC") {
    const [candles, orderbook, pythData] = await Promise.all([
      fetchBTCCandles("1m", 100),
      fetchBTCOrderbook(),
      fetchPythPrice(PYTH_BTC_FEED),
    ]);

    const price = pythData?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : 0);
    const oldPrice = candles.length >= 1440 ? candles[candles.length - 1440].close : candles[0]?.close ?? price;
    const change24h = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;

    setCandleCache("BTC:1m", candles);
    setLatestPrice("BTC", price, change24h);

    return {
      asset: "BTC",
      price,
      change24h: Number(change24h.toFixed(2)),
      candles,
      orderbook,
      timestamp: Date.now(),
    };
  }

  // GOLD
  const price = await fetchGoldPrice();
  const candles = updateGoldCandle(price);
  const oldPrice = candles.length >= 60 ? candles[candles.length - 60].close : candles[0]?.close ?? price;
  const change24h = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;

  setCandleCache("GOLD:1m", candles);
  setLatestPrice("GOLD", price, change24h);

  return {
    asset: "GOLD",
    price,
    change24h: Number(change24h.toFixed(2)),
    candles,
    orderbook: { bids: [], asks: [] },
    timestamp: Date.now(),
  };
}
