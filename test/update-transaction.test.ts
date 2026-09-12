import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseUpdateTransaction,
  validateDayOfMonthOptional,
} from "../lib/validators";
import { ownershipWhere } from "../lib/ownership";
import { fixedIncomes, variableIncomes } from "../db/schema";
import { PgDialect } from "drizzle-orm/pg-core";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ROW_ID = "22222222-2222-2222-2222-222222222222";

function fixedForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("type", "fixed-income");
  fd.set("id", ROW_ID);
  fd.set("description", "Salario");
  fd.set("amount", "150000.5");
  fd.set("category", "Trabajo");
  fd.set("dayOfMonth", "5");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

function variableForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("type", "variable-expense");
  fd.set("id", ROW_ID);
  fd.set("description", "Súper");
  fd.set("amount", "20000");
  fd.set("category", "");
  fd.set("occurredOn", "2026-09-10");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

describe("parseUpdateTransaction", () => {
  it("happy path: fixed income keeps id, sanitizes amount and keeps day", () => {
    const r = parseUpdateTransaction(fixedForm());
    assert.equal(r.kind, "fixed-income");
    assert.equal(r.id, ROW_ID);
    assert.equal(r.description, "Salario");
    assert.equal(r.amount, "150000.50");
    assert.equal(r.category, "Trabajo");
    assert.equal(r.dayOfMonth, 5);
    assert.equal(r.occurredOn, null);
  });

  it("happy path: variable expense parses occurredOn, dayOfMonth stays null", () => {
    const r = parseUpdateTransaction(variableForm());
    assert.equal(r.kind, "variable-expense");
    assert.equal(r.category, null);
    assert.equal(r.occurredOn, "2026-09-10");
    assert.equal(r.dayOfMonth, null);
  });

  describe("validation rejections", () => {
    it("missing description", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ description: " " })), /descripción es obligatoria/);
    });

    it("description over 120 chars", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ description: "x".repeat(121) })), /Máximo 120/);
    });

    it("amount <= 0", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ amount: "0" })), /mayor a 0/);
    });

    it("amount with 3 decimals", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ amount: "1.234" })), /2 decimales/);
    });

    it("category over 40 chars", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ category: "x".repeat(41) })), /máximo 40 caracteres/);
    });

    it("unknown type is rejected", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ type: "fixed-everything" })), /Tipo de movimiento inválido/);
    });

    it("missing id is rejected", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ id: " " })), /ID requerido/);
    });

    it("variable with empty date is rejected", () => {
      assert.throws(() => parseUpdateTransaction(variableForm({ occurredOn: "" })), /Fecha inválida/);
    });
  });

  describe("fixed dayOfMonth (day-anchored edits)", () => {
    it("empty dayOfMonth becomes null (applies to both quincenas)", () => {
      const r = parseUpdateTransaction(fixedForm({ dayOfMonth: "" }));
      assert.equal(r.dayOfMonth, null);
    });

    it("day 1–15/16–31 accepted", () => {
      assert.equal(parseUpdateTransaction(fixedForm({ dayOfMonth: "1" })).dayOfMonth, 1);
      assert.equal(parseUpdateTransaction(fixedForm({ dayOfMonth: "31" })).dayOfMonth, 31);
    });

    it("day 0 and 32 rejected", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ dayOfMonth: "0" })), /1–31/);
      assert.throws(() => parseUpdateTransaction(fixedForm({ dayOfMonth: "32" })), /1–31/);
    });

    it("non-integer day rejected", () => {
      assert.throws(() => parseUpdateTransaction(fixedForm({ dayOfMonth: "2.5" })), /1–31/);
    });
  });
});

describe("validateDayOfMonthOptional", () => {
  it("null/undefined/empty → null", () => {
    assert.equal(validateDayOfMonthOptional(null), null);
    assert.equal(validateDayOfMonthOptional(undefined), null);
    assert.equal(validateDayOfMonthOptional(""), null);
  });
  it("valid day → number", () => {
    assert.equal(validateDayOfMonthOptional("15"), 15);
  });
});

describe("ownershipWhere (IDOR fix)", () => {
  const dialect = new PgDialect();

  it("delete/update where includes BOTH id and user_id", () => {
    const q = dialect.sqlToQuery(
      ownershipWhere(fixedIncomes, ROW_ID, USER_ID)
    );
    assert.ok(q.sql.includes('"id"'), q.sql);
    assert.ok(q.sql.includes('"user_id"'), q.sql);
    assert.deepEqual(q.params, [ROW_ID, USER_ID]);
  });

  it("works for every owned table shape", () => {
    const q = dialect.sqlToQuery(ownershipWhere(variableIncomes, ROW_ID, USER_ID));
    assert.ok(q.sql.includes('"user_id"'), q.sql);
    assert.deepEqual(q.params, [ROW_ID, USER_ID]);
  });
});
