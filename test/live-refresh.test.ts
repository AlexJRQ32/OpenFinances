import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getNextCycleBoundary } from "../lib/cycle";

// Helper: build a LOCAL date (matches the function's local-time contract).
function local(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute);
}

function parts(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    h: d.getHours(),
    min: d.getMinutes(),
  };
}

describe("getNextCycleBoundary", () => {
  describe("quincenal", () => {
    it("day 10 → boundary is 16th of same month at 00:00", () => {
      const b = getNextCycleBoundary("quincenal", local(2026, 9, 10));
      assert.deepEqual(parts(b), { y: 2026, m: 9, d: 16, h: 0, min: 0 });
    });

    it("day 20 → boundary is 1st of next month at 00:00", () => {
      const b = getNextCycleBoundary("quincenal", local(2026, 9, 20));
      assert.deepEqual(parts(b), { y: 2026, m: 10, d: 1, h: 0, min: 0 });
    });

    it("day 15 at 23:59 → boundary is 16th at 00:00 (minutes later)", () => {
      const b = getNextCycleBoundary("quincenal", local(2026, 1, 15, 23, 59));
      assert.deepEqual(parts(b), { y: 2026, m: 1, d: 16, h: 0, min: 0 });
    });

    it("day 16 at 00:00 exactly → boundary is 1st of next month", () => {
      const b = getNextCycleBoundary("quincenal", local(2026, 3, 16));
      assert.deepEqual(parts(b), { y: 2026, m: 4, d: 1, h: 0, min: 0 });
    });

    it("Dec 31 → boundary is Jan 1 of next year", () => {
      const b = getNextCycleBoundary("quincenal", local(2026, 12, 31));
      assert.deepEqual(parts(b), { y: 2027, m: 1, d: 1, h: 0, min: 0 });
    });
  });

  describe("mensual", () => {
    it("Jan 15 → boundary is Feb 1 at 00:00", () => {
      const b = getNextCycleBoundary("mensual", local(2026, 1, 15));
      assert.deepEqual(parts(b), { y: 2026, m: 2, d: 1, h: 0, min: 0 });
    });

    it("Dec 31 → boundary is Jan 1 of next year", () => {
      const b = getNextCycleBoundary("mensual", local(2026, 12, 31));
      assert.deepEqual(parts(b), { y: 2027, m: 1, d: 1, h: 0, min: 0 });
    });

    it("day 1 at 00:00 → boundary is 1st of next month", () => {
      const b = getNextCycleBoundary("mensual", local(2026, 5, 1));
      assert.deepEqual(parts(b), { y: 2026, m: 6, d: 1, h: 0, min: 0 });
    });
  });
});
