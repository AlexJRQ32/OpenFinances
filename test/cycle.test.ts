import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCycleRange, getQuincenaRange, shiftToOffset } from "../lib/cycle";

// Helper: build a UTC date for testing
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function fmtISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("getCycleRange", () => {
  describe("quincenal", () => {
    it("first half: day 1-15", () => {
      const r = getCycleRange("quincenal", d(2026, 9, 7));
      assert.equal(fmtISO(r.start), "2026-09-01");
      assert.equal(fmtISO(r.end), "2026-09-15");
      assert.equal(r.label, "1\u201315 sep");
    });

    it("second half: day 16-end", () => {
      const r = getCycleRange("quincenal", d(2026, 9, 20));
      assert.equal(fmtISO(r.start), "2026-09-16");
      assert.equal(fmtISO(r.end), "2026-09-30");
      assert.equal(r.label, "16\u201330 sep");
    });

    it("month with 31 days", () => {
      const r = getCycleRange("quincenal", d(2026, 1, 25));
      assert.equal(fmtISO(r.start), "2026-01-16");
      assert.equal(fmtISO(r.end), "2026-01-31");
      assert.equal(r.label, "16\u201331 ene");
    });

    it("exactly on day 15 → first half", () => {
      const r = getCycleRange("quincenal", d(2026, 3, 15));
      assert.equal(fmtISO(r.start), "2026-03-01");
      assert.equal(fmtISO(r.end), "2026-03-15");
    });

    it("exactly on day 16 → second half", () => {
      const r = getCycleRange("quincenal", d(2026, 3, 16));
      assert.equal(fmtISO(r.start), "2026-03-16");
      assert.equal(fmtISO(r.end), "2026-03-31");
    });

    it("february non-leap (28 days)", () => {
      const r = getCycleRange("quincenal", d(2025, 2, 20));
      assert.equal(fmtISO(r.start), "2025-02-16");
      assert.equal(fmtISO(r.end), "2025-02-28");
      assert.equal(r.label, "16\u201328 feb");
    });

    it("february leap year (29 days)", () => {
      const r = getCycleRange("quincenal", d(2024, 2, 20));
      assert.equal(fmtISO(r.start), "2024-02-16");
      assert.equal(fmtISO(r.end), "2024-02-29");
      assert.equal(r.label, "16\u201329 feb");
    });
  });

  describe("mensual", () => {
    it("full calendar month", () => {
      const r = getCycleRange("mensual", d(2026, 9, 15));
      assert.equal(fmtISO(r.start), "2026-09-01");
      assert.equal(fmtISO(r.end), "2026-09-30");
      assert.equal(r.label, "septiembre 2026");
    });

    it("across months: january", () => {
      const r = getCycleRange("mensual", d(2026, 1, 1));
      assert.equal(fmtISO(r.start), "2026-01-01");
      assert.equal(fmtISO(r.end), "2026-01-31");
      assert.equal(r.label, "enero 2026");
    });

    it("february leap year", () => {
      const r = getCycleRange("mensual", d(2024, 2, 14));
      assert.equal(fmtISO(r.start), "2024-02-01");
      assert.equal(fmtISO(r.end), "2024-02-29");
      assert.equal(r.label, "febrero 2024");
    });

    it("december", () => {
      const r = getCycleRange("mensual", d(2026, 12, 25));
      assert.equal(fmtISO(r.start), "2026-12-01");
      assert.equal(fmtISO(r.end), "2026-12-31");
      assert.equal(r.label, "diciembre 2026");
    });
  });
});

describe("getQuincenaRange", () => {
  it("Q1: days 1-15 for a 30-day month", () => {
    const r = getQuincenaRange(2026, 8, 1); // September (0-indexed)
    assert.equal(fmtISO(r.start), "2026-09-01");
    assert.equal(fmtISO(r.end), "2026-09-15");
    assert.equal(r.label, "1\u201315 sep");
  });

  it("Q2: days 16-30 for a 30-day month", () => {
    const r = getQuincenaRange(2026, 8, 2); // September
    assert.equal(fmtISO(r.start), "2026-09-16");
    assert.equal(fmtISO(r.end), "2026-09-30");
    assert.equal(r.label, "16\u201330 sep");
  });

  it("Q2: days 16-31 for a 31-day month", () => {
    const r = getQuincenaRange(2026, 0, 2); // January
    assert.equal(fmtISO(r.start), "2026-01-16");
    assert.equal(fmtISO(r.end), "2026-01-31");
    assert.equal(r.label, "16\u201331 ene");
  });

  it("Q2: february leap year (16-29)", () => {
    const r = getQuincenaRange(2024, 1, 2); // February leap
    assert.equal(fmtISO(r.start), "2024-02-16");
    assert.equal(fmtISO(r.end), "2024-02-29");
    assert.equal(r.label, "16\u201329 feb");
  });

  it("Q2: february non-leap (16-28)", () => {
    const r = getQuincenaRange(2025, 1, 2); // February non-leap
    assert.equal(fmtISO(r.start), "2025-02-16");
    assert.equal(fmtISO(r.end), "2025-02-28");
    assert.equal(r.label, "16\u201328 feb");
  });
});

describe("shiftToOffset", () => {
  it("Costa Rica (UTC-6, offset 360): Sep 15 23:00Z stays Sep 15", () => {
    // 2026-09-15T23:00:00Z → UTC-6 = Sep 15 17:00 local
    const utc = new Date("2026-09-15T23:00:00Z");
    const shifted = shiftToOffset(utc, 360);
    assert.equal(shifted.getUTCFullYear(), 2026);
    assert.equal(shifted.getUTCMonth(), 8); // September (0-indexed)
    assert.equal(shifted.getUTCDate(), 15);
    assert.equal(shifted.getUTCHours(), 17);
  });

  it("UTC+1 (offset -60): Sep 15 23:00Z becomes Sep 16", () => {
    // 2026-09-15T23:00:00Z → UTC+1 = Sep 16 00:00 local
    const utc = new Date("2026-09-15T23:00:00Z");
    const shifted = shiftToOffset(utc, -60);
    assert.equal(shifted.getUTCDate(), 16);
    assert.equal(shifted.getUTCHours(), 0);
  });

  it("Costa Rica (UTC-6, offset 360): Sep 1 00:30Z becomes Aug 31", () => {
    // 2026-09-01T00:30:00Z → UTC-6 = Aug 31 18:30 local
    const utc = new Date("2026-09-01T00:30:00Z");
    const shifted = shiftToOffset(utc, 360);
    assert.equal(shifted.getUTCMonth(), 7); // August (0-indexed)
    assert.equal(shifted.getUTCDate(), 31);
    assert.equal(shifted.getUTCHours(), 18);
    assert.equal(shifted.getUTCMinutes(), 30);
  });

  it("offset 0 → identity", () => {
    const utc = new Date("2026-09-15T12:00:00Z");
    const shifted = shiftToOffset(utc, 0);
    assert.equal(shifted.getTime(), utc.getTime());
    assert.equal(shifted.getUTCDate(), 15);
    assert.equal(shifted.getUTCHours(), 12);
  });
});
