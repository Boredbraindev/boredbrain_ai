/**
 * CoinGecko API Integration for Agent Executor
 *
 * Standalone coin data tool that uses raw fetch() to call CoinGecko.
 * Returns mock data when COINGECKO_API_KEY is not configured.
 */

import { serverEnv } from '@/env/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function mockCoinData(coinId: string) {
  const mockPrices: Record<string, number> = {
    bitcoin: 97250.42,
    ethereum: 3425.18,
    solana: 178.93,
    dogecoin: 0.1245,
    cardano: 0.4512,
    ripple: 0.6234,
  };

  const price = mockPrices[coinId] ?? 1.0;

  return {
    success: true,
    simulated: true,
    coinId,
    data: {
      id: coinId,
      symbol: coinId.slice(0, 3),
      name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
      market_data: {
        current_price: { usd: price },
        market_cap: { usd: price * 19_500_000 },
        total_volume: { usd: price * 1_200_000 },
        price_change_percentage_24h: (Math.random() * 10 - 5).toFixed(2),
        price_change_percentage_7d: (Math.random() * 20 - 10).toFixed(2),
        circulating_supply: 19_500_000,
        high_24h: { usd: price * 1.03 },
        low_24h: { usd: price * 0.97 },
      },
      description: {
        en: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} is a cryptocurrency. This is simulated data -- configure COINGECKO_API_KEY for real market data.`,
      },
    },
    source: 'CoinGecko API (simulated)',
    url: `https://www.coingecko.com/en/coins/${coinId}`,
  };
}

function mockOhlcData(coinId: string, days: number) {
  const basePrice =
    coinId === 'bitcoin'
      ? 97250
      : coinId === 'ethereum'
        ? 3425
        : coinId === 'solana'
          ? 178
          : 1.0;

  const points = Math.min(days * 4, 100);
  const now = Date.now();
  const interval = (days * 24 * 60 * 60 * 1000) / points;

  const ohlcData = Array.from({ length: points }, (_, i) => {
    const timestamp = now - (points - i) * interval;
    const volatility = basePrice * 0.02;
    const open = basePrice + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    return {
      timestamp,
      date: new Date(timestamp).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    };
  });

  return {
    success: true,
    simulated: true,
    coinId,
    days,
    chart: {
      title: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} OHLC Chart`,
      type: 'candlestick',
      data: ohlcData,
    },
    source: 'CoinGecko API (simulated)',
    url: `https://www.coingecko.com/en/coins/${coinId}`,
  };
}

// ---------------------------------------------------------------------------
// Real API calls
// ---------------------------------------------------------------------------

/**
 * Fetch comprehensive coin data from CoinGecko.
 */
export async function executeCoinData(args: { coinId: string }): Promise<unknown> {
  const { coinId } = args;
  const apiKey = serverEnv.COINGECKO_API_KEY;

  if (!apiKey) {
    console.log('[coin-data] No COINGECKO_API_KEY, returning mock data');
    return mockCoinData(coinId);
  }

  try {
    const params = new URLSearchParams({
      localization: 'false',
      tickers: 'false',
      market_data: 'true',
      community_data: 'false',
      developer_data: 'false',
      sparkline: 'false',
    });

    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?${params}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'x-cg-demo-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Price data temporarily unavailable. Please try again.');
    }

    const data = await response.json();

    return {
      success: true,
      simulated: false,
      coinId,
      data: {
        id: data.id,
        symbol: data.symbol,
        name: data.name,
        market_data: {
          current_price: data.market_data?.current_price,
          market_cap: data.market_data?.market_cap,
          total_volume: data.market_data?.total_volume,
          price_change_percentage_24h: data.market_data?.price_change_percentage_24h,
          price_change_percentage_7d: data.market_data?.price_change_percentage_7d_in_currency,
          circulating_supply: data.market_data?.circulating_supply,
          high_24h: data.market_data?.high_24h,
          low_24h: data.market_data?.low_24h,
          ath: data.market_data?.ath,
        },
        description: { en: data.description?.en?.slice(0, 500) },
        links: {
          homepage: data.links?.homepage?.[0],
          blockchain_site: data.links?.blockchain_site?.filter(Boolean)?.slice(0, 3),
        },
      },
      source: 'CoinGecko API',
      url: `https://www.coingecko.com/en/coins/${coinId}`,
    };
  } catch (error) {
    console.error('[coin-data] CoinGecko API error:', error);
    // Fall back to mock on error
    const mock = mockCoinData(coinId);
    mock.simulated = true;
    return {
      ...mock,
      _error: error instanceof Error ? error.message : 'API call failed',
    };
  }
}

/**
 * Fetch OHLC candlestick data from CoinGecko.
 */
export async function executeCoinOhlc(args: {
  coinId: string;
  days?: number;
  vsCurrency?: string;
}): Promise<unknown> {
  const { coinId, days = 7, vsCurrency = 'usd' } = args;
  const apiKey = serverEnv.COINGECKO_API_KEY;

  if (!apiKey) {
    console.log('[coin-ohlc] No COINGECKO_API_KEY, returning mock data');
    return mockOhlcData(coinId, days);
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=${encodeURIComponent(vsCurrency)}&days=${days}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'x-cg-demo-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Chart data temporarily unavailable. Please try again.');
    }

    const rawData = await response.json();

    const ohlcData = rawData.map(
      ([timestamp, open, high, low, close]: [number, number, number, number, number]) => ({
        timestamp,
        date: new Date(timestamp).toISOString(),
        open,
        high,
        low,
        close,
      }),
    );

    return {
      success: true,
      simulated: false,
      coinId,
      vsCurrency,
      days,
      chart: {
        title: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} OHLC Chart`,
        type: 'candlestick',
        data: ohlcData,
        dataPoints: ohlcData.length,
      },
      source: 'CoinGecko API',
      url: `https://www.coingecko.com/en/coins/${coinId}`,
    };
  } catch (error) {
    console.error('[coin-ohlc] CoinGecko API error:', error);
    const mock = mockOhlcData(coinId, days);
    return {
      ...mock,
      _error: error instanceof Error ? error.message : 'API call failed',
    };
  }
}
