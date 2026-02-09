import type { MarketData, Candle, OrderBook } from "@/lib/types";

async function fetchJSON(url: string, timeout = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function fetchBinance(): Promise<Candle[]> {
  const raw = await fetchJSON(
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=60"
  );
  return (raw as number[][]).map((c) => ({
    timestamp: c[0],
    open: parseFloat(c[1] as unknown as string),
    high: parseFloat(c[2] as unknown as string),
    low: parseFloat(c[3] as unknown as string),
    close: parseFloat(c[4] as unknown as string),
    volume: parseFloat(c[5] as unknown as string),
  }));
}

async function fetchPyth(): Promise<{ price: number; confidence: number }> {
  const raw = await fetchJSON(
    "https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  );
  const feed = raw[0];
  const expo = feed.price.expo;
  const price = Number(feed.price.price) * 10 ** expo;
  const conf = Number(feed.price.conf) * 10 ** expo;
  return { price, confidence: conf };
}

async function fetchCoinbase(): Promise<OrderBook> {
  const raw = await fetchJSON(
    "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2"
  );
  return {
    bids: (raw.bids as string[][]).slice(0, 20).map((b) => [parseFloat(b[0]), parseFloat(b[1])]),
    asks: (raw.asks as string[][]).slice(0, 20).map((a) => [parseFloat(a[0]), parseFloat(a[1])]),
  };
}

export async function fetchMarketData(): Promise<MarketData> {
  const sources = { binance: false, pyth: false, coinbase: false };
  let candles: Candle[] = [];
  let price = 0;
  let confidence = 0;
  let orderbook: OrderBook = { bids: [], asks: [] };

  const [binRes, pythRes, cbRes] = await Promise.allSettled([
    fetchBinance(),
    fetchPyth(),
    fetchCoinbase(),
  ]);

  if (binRes.status === "fulfilled") {
    candles = binRes.value;
    sources.binance = true;
  }
  if (pythRes.status === "fulfilled") {
    price = pythRes.value.price;
    confidence = pythRes.value.confidence;
    sources.pyth = true;
  }
  if (cbRes.status === "fulfilled") {
    orderbook = cbRes.value;
    sources.coinbase = true;
  }

  // Fallback price from candles if Pyth fails
  if (!sources.pyth && candles.length > 0) {
    price = candles[candles.length - 1].close;
  }

  return {
    candles,
    price,
    confidence,
    orderbook,
    timestamp: new Date().toISOString(),
    sources,
  };
}
