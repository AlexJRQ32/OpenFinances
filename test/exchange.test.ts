import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  convertUsdToCrc,
  parseCurrency,
  prepareCurrencyAmount,
  fetchRate,
  exchangeRateCache,
  ExchangeRateUnavailableError,
  TTL_MS,
} from "../lib/exchange";
import { getTableColumns } from "drizzle-orm";
import { fixedIncomes, variableIncomes, fixedExpenses, variableExpenses } from "../db/schema";

const HACIENDA_MOCK = {
  venta: { fecha: "2026-09-11", valor: 450.06 },
  compra: { fecha: "2026-09-11", valor: 444.22 },
};

describe("convertUsdToCrc", () => {
  it("converts and rounds to 2 decimals", () => {
    assert.equal(convertUsdToCrc("10", 450.06), "4500.60");
    assert.equal(convertUsdToCrc("3.33", 450.06), "1498.70");
    assert.equal(convertUsdToCrc("0.01", 450.06), "4.50");
  });
});

describe("parseCurrency", () => {
  it("defaults to CRC on missing/unknown value", () => {
    assert.equal(parseCurrency(null), "CRC");
    assert.equal(parseCurrency(undefined), "CRC");
    assert.equal(parseCurrency(""), "CRC");
    assert.equal(parseCurrency("MXN"), "CRC");
  });

  it("accepts USD case-insensitively", () => {
    assert.equal(parseCurrency("USD"), "USD");
    assert.equal(parseCurrency("usd"), "USD");
  });

  it("accepts CRC explicitly", () => {
    assert.equal(parseCurrency("CRC"), "CRC");
    assert.equal(parseCurrency("crc"), "CRC");
  });
});

describe("fetchRate", () => {
  let fetchCalls: string[] = [];
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    exchangeRateCache.rate = null;
    exchangeRateCache.fetchedAt = 0;
    fetchCalls = [];
    globalThis.fetch = (async (input: string | URL) => {
      fetchCalls.push(String(input));
      return new Response(JSON.stringify(HACIENDA_MOCK), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });

  it("fetches venta rate from Hacienda and caches it (12h TTL, single request on hit)", async () => {
    const r1 = await fetchRate();
    assert.equal(r1, 450.06);
    const callsAfterFirst = fetchCalls.length;
    const r2 = await fetchRate();
    assert.equal(r2, 450.06);
    assert.equal(fetchCalls.length, callsAfterFirst, "cache hit must not refetch");

    // Expire cache manually → next call refetches
    exchangeRateCache.fetchedAt = Date.now() - TTL_MS - 1000;
    await fetchRate();
    assert.equal(fetchCalls.length, callsAfterFirst + 1);
  });

  it("retries Hacienda once before failing fallback-free", async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      if (attempts === 1) throw new Error("network blip");
      return new Response(JSON.stringify(HACIENDA_MOCK), { status: 200 });
    }) as typeof fetch;
    const rate = await fetchRate();
    assert.equal(rate, 450.06);
    assert.equal(attempts, 2, "must retry once, not twice");
  });

  it("falls back to ticorates when Hacienda is down twice", async () => {
    globalThis.fetch = (async (input: string | URL) => {
      if (String(input).includes("hacienda.go.cr")) throw new Error("down");
      return new Response(
        JSON.stringify({ data: { CRC: { USD: { sale: 450.5, purchase: 444.0 } } } }),
        { status: 200 }
      );
    }) as typeof fetch;
    const rate = await fetchRate();
    assert.equal(rate, 450.5);
  });

  it("throws ExchangeRateUnavailableError when primary + fallback both fail", async () => {
    globalThis.fetch = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    await assert.rejects(fetchRate(), ExchangeRateUnavailableError);
  });
});

describe("prepareCurrencyAmount", () => {
  beforeEach(() => {
    exchangeRateCache.rate = 450.06;
    exchangeRateCache.fetchedAt = Date.now();
  });

  it("CRC: keeps amount verbatim, no exchange rate", async () => {
    const m = await prepareCurrencyAmount("150000.50", "CRC");
    assert.deepEqual(m, {
      amount: "150000.50",
      originalAmount: "150000.50",
      currency: "CRC",
      exchangeRate: null,
    });
  });

  it("missing currency defaults to CRC without network", async () => {
    globalThis.fetch = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;
    const m = await prepareCurrencyAmount("20000", null);
    assert.equal(m.currency, "CRC");
    assert.equal(m.amount, "20000");
  });

  it("USD: converts to CRC amount, keeps USD original and freezes rate", async () => {
    const m = await prepareCurrencyAmount("10", "USD");
    assert.equal(m.amount, "4500.60");
    assert.equal(m.originalAmount, "10.00");
    assert.equal(m.currency, "USD");
    assert.equal(m.exchangeRate, "450.0600");
  });
});

describe("schema (drizzle introspection)", () => {
  const TABLES: [string, object][] = [
    ["fixed_incomes", fixedIncomes],
    ["variable_incomes", variableIncomes],
    ["fixed_expenses", fixedExpenses],
    ["variable_expenses", variableExpenses],
  ];
  const expected = ["original_amount", "currency", "exchange_rate"];

  it("all 4 movement tables gained the 3 currency columns", () => {
    for (const [name, table] of TABLES) {
      const cols = Object.values(getTableColumns(table as never)).map((c) => String((c as { name: string }).name));
      for (const col of expected) {
        assert.ok(cols.includes(col), `${name} missing ${col}`);
      }
    }
  });
});
