// USD→CRC exchange rate (plan D1/D2/D5/D7/D8).
// Primary: Hacienda of Rentas API (oficial = BCCR values, no key). Fallback: ticorates.dev.
// amount stays canonical CRC (D8) — these helpers are only for conversion + audit columns.

const HACIENDA_URL = "https://api.hacienda.go.cr/indicadores/tc/dolar";
const TICO_URL = "https://api.ticorates.dev/v1/rates?base=CRC&target=USD";
// ponytail: ticorates.dev unreachable from this network (DNS fail) — fallback endpoint
// shape unverified; unverified = still safe, since on failure we reject USD instead of guessing.
const TTL_VALUE = 12 * 60 * 60 * 1000; // 12h (plan D5)
export const TTL_MS = TTL_VALUE;
const FIRST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 300;

export class ExchangeRateUnavailableError extends Error {
  constructor() {
    super(
      "No se pudo obtener el tipo de cambio (BCCR). Intentá de nuevo en un momento, o guardá el movimiento en colones."
    );
    this.name = "ExchangeRateUnavailableError";
  }
}

export interface HaciendaDolar {
  venta: { fecha: string; valor: number };
  compra: { fecha: string; valor: number };
}

interface TicoRates {
  data: Record<string, Record<string, { sale?: number; purchase?: number }>>;
}

// Module-level cache; exposed so tests can prime/expire it.
export const exchangeRateCache: { rate: number | null; fetchedAt: number } = {
  rate: null,
  fetchedAt: 0,
};

let inflight: Promise<number> | null = null;

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** USD amount → CRC string, rounded to 2 decimals (D7). */
export function convertUsdToCrc(usd: string | number, rate: number): string {
  return (Math.round(Number(usd) * rate * 100) / 100).toFixed(2);
}

export type CurrencyCode = "USD" | "CRC";

/** Form's currency field: default CRC (mínima sorpresa; selects are v2+). */
export function parseCurrency(raw: unknown): CurrencyCode {
  const value = String(raw ?? "").trim().toUpperCase();
  return value === "USD" ? "USD" : "CRC";
}

// ── Fetching ─────────────────────────────────────────────────────────────────

function parseRate(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error("invalid rate from response");
  return num;
}

async function fetchHacienda(): Promise<number> {
  const res = await fetch(HACIENDA_URL, {
    signal: AbortSignal.timeout(FIRST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`hacienda HTTP ${res.status}`);
  const data = (await res.json()) as HaciendaDolar;
  return parseRate(data?.venta?.valor); // D2: venta for USD→CRC
}

async function fetchTicorates(): Promise<number> {
  const res = await fetch(TICO_URL, {
    signal: AbortSignal.timeout(FIRST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ticorates HTTP ${res.status}`);
  const data = (await res.json()) as TicoRates;
  return parseRate(data?.data?.CRC?.USD?.sale);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Current USD→CRC rate (venta, D2). Module-level 12h cache + 1 immediate retry
 * on Hacienda, then ticorates fallback. If all fail: ExchangeRateUnavailableError
 * — callers must reject the USD movement rather than guess a rate (D5).
 */
export async function fetchRate(): Promise<number> {
  const now = Date.now();
  const cached = exchangeRateCache.rate;
  if (cached != null && now - exchangeRateCache.fetchedAt < TTL_MS) {
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rate = await fetchHacienda();
        exchangeRateCache.rate = rate;
        exchangeRateCache.fetchedAt = Date.now();
        return rate;
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await delay(RETRY_DELAY_MS);
      }
    }
    try {
      const rate = await fetchTicorates();
      exchangeRateCache.rate = rate;
      exchangeRateCache.fetchedAt = Date.now();
      return rate;
    } catch (err) {
      lastErr = err;
    }
    throw new ExchangeRateUnavailableError();
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// ── Amount resolution for server actions ─────────────────────────────────────

export interface CurrencyMoney {
  /** Canonical CRC amount to store in `amount` (D8). */
  amount: string;
  /** Display/audit: USD input or the CRC amount itself. */
  originalAmount: string;
  currency: CurrencyCode;
  /** Frozen venta rate (4 decimals) for USD, null for CRC. */
  exchangeRate: string | null;
}

/**
 * Turns a validated amount string + form currency into the full column set.
 * CRC → stores verbatim with originalAmount=amount (self-consistent), rate null.
 * USD → asks for the current rate; on unavailable rate it throws ExchangeRateUnavailableError.
 */
export async function prepareCurrencyAmount(
  amount: string,
  currencyRaw: unknown
): Promise<CurrencyMoney> {
  const currency = parseCurrency(currencyRaw);
  const originalAmount = Number(amount).toFixed(2); // D7: USD 2 decimals
  if (currency === "CRC") {
    return { amount, originalAmount, currency: "CRC", exchangeRate: null };
  }
  const rate = await fetchRate();
  return {
    amount: convertUsdToCrc(amount, rate),
    originalAmount,
    currency: "USD",
    exchangeRate: rate.toFixed(4),
  };
}
