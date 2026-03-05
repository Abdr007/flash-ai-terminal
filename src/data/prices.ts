import { getLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/retry.js';

export interface TokenPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

// CoinGecko symbol → ID mapping
const COINGECKO_IDS: Record<string, string> = {
  SOL: 'solana',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  ZEC: 'zcash',
  JTO: 'jito-governance-token',
  JUP: 'jupiter-exchange-solana',
  PYTH: 'pyth-network',
  RAY: 'raydium',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  PENGU: 'pudgy-penguins',
  ORE: 'ore',
  HYPE: 'hyperliquid',
};

// Fallback prices used when all APIs fail
const FALLBACK_PRICES: Record<string, number> = {
  SOL: 150,
  BTC: 65000,
  ETH: 3000,
  BNB: 600,
  ZEC: 30,
  JTO: 3,
  JUP: 1.2,
  PYTH: 0.4,
  RAY: 2,
  BONK: 0.00003,
  WIF: 2,
  PENGU: 0.01,
  ORE: 1.5,
  HYPE: 20,
  FARTCOIN: 0.5,
  PUMP: 0.01,
  XAU: 2400,
  XAG: 30,
  CRUDEOIL: 75,
  EUR: 1.08,
  GBP: 1.27,
  KMNO: 0.1,
  MET: 0.5,
};

const FETCH_TIMEOUT_MS = 8_000;

export class PriceService {
  private cache: Map<string, { data: TokenPrice; expiry: number }> = new Map();
  private cacheTtlMs = 15_000; // 15s cache

  /**
   * Fetch prices for the given symbols.
   * Strategy: CoinGecko API → fallback hardcoded prices.
   */
  async getPrices(symbols: string[]): Promise<Map<string, TokenPrice>> {
    const priceMap = new Map<string, TokenPrice>();
    const now = Date.now();
    const logger = getLogger();

    // Check cache first
    const uncached: string[] = [];
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const cached = this.cache.get(upper);
      if (cached && cached.expiry > now) {
        priceMap.set(upper, cached.data);
      } else {
        uncached.push(upper);
      }
    }

    if (uncached.length === 0) return priceMap;

    // Try CoinGecko API
    try {
      logger.debug('PRICE', `Fetching prices for: ${uncached.join(', ')}`);
      const fetched = await this.fetchFromCoinGecko(uncached);
      for (const tp of fetched) {
        priceMap.set(tp.symbol, tp);
        this.cache.set(tp.symbol, { data: tp, expiry: now + this.cacheTtlMs });
      }
      logger.info('PRICE', `Fetched ${fetched.length} prices from CoinGecko`);
    } catch (error: unknown) {
      logger.warn('PRICE', `CoinGecko fetch failed: ${getErrorMessage(error)}`);
    }

    // Fill missing symbols with fallback prices
    for (const sym of uncached) {
      if (!priceMap.has(sym)) {
        const fallback = FALLBACK_PRICES[sym];
        if (fallback) {
          const tp: TokenPrice = { symbol: sym, price: fallback, timestamp: now };
          priceMap.set(sym, tp);
          this.cache.set(sym, { data: tp, expiry: now + this.cacheTtlMs });
          logger.debug('PRICE', `Using fallback price for ${sym}: $${fallback}`);
        } else {
          logger.warn('PRICE', `No price available for ${sym}`);
        }
      }
    }

    return priceMap;
  }

  async getPrice(symbol: string): Promise<TokenPrice | null> {
    const prices = await this.getPrices([symbol]);
    return prices.get(symbol.toUpperCase()) ?? null;
  }

  private async fetchFromCoinGecko(symbols: string[]): Promise<TokenPrice[]> {
    // Map symbols to CoinGecko IDs
    const ids: string[] = [];
    const idToSymbol = new Map<string, string>();
    for (const sym of symbols) {
      const id = COINGECKO_IDS[sym];
      if (id) {
        ids.push(id);
        idToSymbol.set(id, sym);
      }
    }

    if (ids.length === 0) return [];

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);
      }

      const data = await res.json() as Record<string, { usd?: number }>;
      const results: TokenPrice[] = [];
      const now = Date.now();

      for (const [id, priceData] of Object.entries(data)) {
        const sym = idToSymbol.get(id);
        if (sym && priceData?.usd && priceData.usd > 0) {
          results.push({ symbol: sym, price: priceData.usd, timestamp: now });
        }
      }

      return results;
    } finally {
      clearTimeout(timeout);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
