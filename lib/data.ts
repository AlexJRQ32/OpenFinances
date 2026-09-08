import "server-only";
import { getDb, isDbAvailable } from "@/db";
import {
  fixedIncomes,
  fixedExpenses,
  variableIncomes,
  variableExpenses,
} from "@/db/schema";
import { eq, and, gte, lte, asc, type InferSelectModel } from "drizzle-orm";
import { getCurrentUser, DbNotConfiguredError } from "@/auth";
import { getCycleRange, fixedAppliesToCycle, type CycleMode, type CycleRange } from "@/lib/cycle";

// Re-export for convenience
export type { CycleMode, CycleRange };
export { DbNotConfiguredError };

// ── Types ────────────────────────────────────────────────────────────────────

export type FixedIncome = InferSelectModel<typeof fixedIncomes>;
export type FixedExpense = InferSelectModel<typeof fixedExpenses>;
export type VariableIncome = InferSelectModel<typeof variableIncomes>;
export type VariableExpense = InferSelectModel<typeof variableExpenses>;

export interface Summary {
  cycleLabel: string;
  fixedIncomesTotal: string;
  variableIncomesTotal: string;
  fixedExpensesTotal: string;
  variableExpensesTotal: string;
  sobrante: string;
  fixedIncomes: FixedIncome[];
  variableIncomes: VariableIncome[];
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireDb() {
  if (!isDbAvailable()) {
    throw new DbNotConfiguredError();
  }
  return getDb();
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── List functions ───────────────────────────────────────────────────────────

export async function listFixedIncomes(): Promise<FixedIncome[]> {
  const user = await getCurrentUser();
  const db = requireDb();
  return db
    .select()
    .from(fixedIncomes)
    .where(eq(fixedIncomes.userId, user.id))
    .orderBy(asc(fixedIncomes.dayOfMonth), asc(fixedIncomes.description));
}

export async function listFixedExpenses(): Promise<FixedExpense[]> {
  const user = await getCurrentUser();
  const db = requireDb();
  return db
    .select()
    .from(fixedExpenses)
    .where(eq(fixedExpenses.userId, user.id))
    .orderBy(asc(fixedExpenses.dayOfMonth), asc(fixedExpenses.description));
}

export async function listVariableIncomes(
  range: CycleRange
): Promise<VariableIncome[]> {
  const user = await getCurrentUser();
  const db = requireDb();
  const startISO = toISO(range.start);
  const endISO = toISO(range.end);
  return db
    .select()
    .from(variableIncomes)
    .where(
      and(
        eq(variableIncomes.userId, user.id),
        gte(variableIncomes.occurredOn, startISO),
        lte(variableIncomes.occurredOn, endISO)
      )
    )
    .orderBy(asc(variableIncomes.occurredOn), asc(variableIncomes.description));
}

export async function listVariableExpenses(
  range: CycleRange
): Promise<VariableExpense[]> {
  const user = await getCurrentUser();
  const db = requireDb();
  const startISO = toISO(range.start);
  const endISO = toISO(range.end);
  return db
    .select()
    .from(variableExpenses)
    .where(
      and(
        eq(variableExpenses.userId, user.id),
        gte(variableExpenses.occurredOn, startISO),
        lte(variableExpenses.occurredOn, endISO)
      )
    )
    .orderBy(asc(variableExpenses.occurredOn), asc(variableExpenses.description));
}

// ── Summary ──────────────────────────────────────────────────────────────────

function sumAmounts(items: { amount: string | number }[]): string {
  const total = items.reduce((acc, item) => acc + Number(item.amount), 0);
  return total.toFixed(2);
}

/**
 * Compute full summary for the current user's cycle.
 * Throws DbNotConfiguredError if DATABASE_URL is not set.
 */
export async function computeSummary(
  _userId: string,
  mode: CycleMode,
  refDate: Date
): Promise<Summary> {
  const range = getCycleRange(mode, refDate);
  const [allFi, vi, allFe, ve] = await Promise.all([
    listFixedIncomes(),
    listVariableIncomes(range),
    listFixedExpenses(),
    listVariableExpenses(range),
  ]);

  // Filter fixed items by cycle when in quincenal mode
  const fi = allFi.filter((item) =>
    fixedAppliesToCycle(item.dayOfMonth, range.start, range.end, mode)
  );
  const fe = allFe.filter((item) =>
    fixedAppliesToCycle(item.dayOfMonth, range.start, range.end, mode)
  );

  const fixedIncomesTotal = sumAmounts(fi);
  const variableIncomesTotal = sumAmounts(vi);
  const fixedExpensesTotal = sumAmounts(fe);
  const variableExpensesTotal = sumAmounts(ve);

  const income = Number(fixedIncomesTotal) + Number(variableIncomesTotal);
  const expenses = Number(fixedExpensesTotal) + Number(variableExpensesTotal);
  const sobrante = (income - expenses).toFixed(2);

  return {
    cycleLabel: range.label,
    fixedIncomesTotal,
    variableIncomesTotal,
    fixedExpensesTotal,
    variableExpensesTotal,
    sobrante,
    fixedIncomes: fi,
    variableIncomes: vi,
    fixedExpenses: fe,
    variableExpenses: ve,
  };
}
