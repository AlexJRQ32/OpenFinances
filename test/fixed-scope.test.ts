import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fixedAppliesToCycle } from "../lib/cycle";

// Helper: build a UTC date for testing
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe("fixedAppliesToCycle", () => {
  describe("quincenal mode", () => {
    it("day 5 in Q1 range (1-15) → true", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 15);
      assert.equal(fixedAppliesToCycle(5, start, end, "quincenal"), true);
    });

    it("day 20 in Q1 range (1-15) → false", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 15);
      assert.equal(fixedAppliesToCycle(20, start, end, "quincenal"), false);
    });

    it("day 20 in Q2 range (16-30) → true", () => {
      const start = d(2026, 9, 16);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(20, start, end, "quincenal"), true);
    });

    it("day 5 in Q2 range (16-30) → false", () => {
      const start = d(2026, 9, 16);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(5, start, end, "quincenal"), false);
    });

    it("null day in any range → true", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 15);
      assert.equal(fixedAppliesToCycle(null, start, end, "quincenal"), true);
    });

    it("undefined day in any range → true", () => {
      const start = d(2026, 9, 16);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(undefined, start, end, "quincenal"), true);
    });

    it("day 31 in Q2 of 30-day month (Sep) → false", () => {
      const start = d(2026, 9, 16);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(31, start, end, "quincenal"), false);
    });

    it("day 15 in Q1 range (boundary) → true", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 15);
      assert.equal(fixedAppliesToCycle(15, start, end, "quincenal"), true);
    });

    it("day 16 in Q2 range (boundary) → true", () => {
      const start = d(2026, 9, 16);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(16, start, end, "quincenal"), true);
    });
  });

  describe("mensual mode", () => {
    it("any day in mensual → true", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(5, start, end, "mensual"), true);
      assert.equal(fixedAppliesToCycle(15, start, end, "mensual"), true);
      assert.equal(fixedAppliesToCycle(20, start, end, "mensual"), true);
      assert.equal(fixedAppliesToCycle(31, start, end, "mensual"), true);
    });

    it("null day in mensual → true", () => {
      const start = d(2026, 9, 1);
      const end = d(2026, 9, 30);
      assert.equal(fixedAppliesToCycle(null, start, end, "mensual"), true);
    });
  });
});
