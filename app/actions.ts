"use server";

import { revalidatePath } from "next/cache";
import { getDb, isDbAvailable } from "@/db";
import {
  fixedIncomes,
  fixedExpenses,
  variableIncomes,
  variableExpenses,
  users,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, signIn } from "@/auth";
import { hashPassword } from "@/lib/password";
import {
  validateDescription,
  validateAmount,
  validateCategory,
  validateDayOfMonth,
  validateDate,
  parseUpdateTransaction,
} from "@/lib/validators";
import { ownershipWhere } from "@/lib/ownership";
import { prepareCurrencyAmount } from "@/lib/exchange";

// ── Validation helpers ───────────────────────────────────────────────────────
// (pure validators moved to lib/validators.ts — unit-testable standalone)

// ── Fixed Incomes ────────────────────────────────────────────────────────────

export async function createFixedIncome(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const dayOfMonth = validateDayOfMonth(formData.get("dayOfMonth"));
  const money = await prepareCurrencyAmount(amount, formData.get("currency"));

  const db = getDb();
  await db.insert(fixedIncomes).values({
    userId: user.id,
    description,
    ...money,
    category,
    dayOfMonth,
  });
  revalidatePath("/");
}

export async function deleteFixedIncome(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("ID requerido");

  const db = getDb();
  await db
    .delete(fixedIncomes)
    .where(ownershipWhere(fixedIncomes, id, user.id));
  revalidatePath("/");
}

// ── Fixed Expenses ───────────────────────────────────────────────────────────

export async function createFixedExpense(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const dayOfMonth = validateDayOfMonth(formData.get("dayOfMonth"));
  const money = await prepareCurrencyAmount(amount, formData.get("currency"));

  const db = getDb();
  await db.insert(fixedExpenses).values({
    userId: user.id,
    description,
    ...money,
    category,
    dayOfMonth,
  });
  revalidatePath("/");
}

export async function deleteFixedExpense(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("ID requerido");

  const db = getDb();
  await db
    .delete(fixedExpenses)
    .where(ownershipWhere(fixedExpenses, id, user.id));
  revalidatePath("/");
}

// ── Variable Incomes ─────────────────────────────────────────────────────────

export async function createVariableIncome(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const occurredOn = validateDate(formData.get("occurredOn"));
  const money = await prepareCurrencyAmount(amount, formData.get("currency"));

  const db = getDb();
  await db.insert(variableIncomes).values({
    userId: user.id,
    description,
    ...money,
    category,
    occurredOn,
  });
  revalidatePath("/");
}

export async function deleteVariableIncome(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("ID requerido");

  const db = getDb();
  await db
    .delete(variableIncomes)
    .where(ownershipWhere(variableIncomes, id, user.id));
  revalidatePath("/");
}

// ── Variable Expenses ────────────────────────────────────────────────────────

export async function createVariableExpense(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const occurredOn = validateDate(formData.get("occurredOn"));
  const money = await prepareCurrencyAmount(amount, formData.get("currency"));

  const db = getDb();
  await db.insert(variableExpenses).values({
    userId: user.id,
    description,
    ...money,
    category,
    occurredOn,
  });
  revalidatePath("/");
}

export async function deleteVariableExpense(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("ID requerido");

  const db = getDb();
  await db
    .delete(variableExpenses)
    .where(ownershipWhere(variableExpenses, id, user.id));
  revalidatePath("/");
}

// ── Update transaction ───────────────────────────────────────────────────────

const UPDATE_TABLES = {
  "fixed-income": fixedIncomes,
  "fixed-expense": fixedExpenses,
  "variable-income": variableIncomes,
  "variable-expense": variableExpenses,
} as const;

export async function updateTransaction(formData: FormData) {
  const user = await getCurrentUser();
  const input = parseUpdateTransaction(formData);
  const table = UPDATE_TABLES[input.kind];

  const db = getDb();
  const money = await prepareCurrencyAmount(input.amount, formData.get("currency"));
  const set: Record<string, string | number | null> = {
    description: input.description,
    ...money,
    category: input.category,
  };
  if (input.kind.startsWith("fixed")) set.dayOfMonth = input.dayOfMonth;
  else set.occurredOn = input.occurredOn;

  const [updated] = await db
    .update(table)
    .set(set)
    .where(ownershipWhere(table, input.id, user.id))
    .returning({ id: table.id });

  if (!updated) {
    // Covers missing id AND someone else's row (ownership/Cross-user)
    throw new Error("Movimiento no encontrado");
  }
  revalidatePath("/");
}

// ── Cycle Mode ───────────────────────────────────────────────────────────────

export async function updateCycleMode(formData: FormData) {
  const user = await getCurrentUser();
  const mode = String(formData.get("cycleMode"));
  if (mode !== "quincenal" && mode !== "mensual") {
    throw new Error("Modo inválido");
  }

  const db = getDb();
  await db
    .update(users)
    .set({ cycleMode: mode })
    .where(eq(users.id, user.id));
  revalidatePath("/");
}

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Register a new user with email + password.
 * Returns { error: string } on failure, or attempts signIn on success.
 */
export async function registerUser(
  formData: FormData,
): Promise<{ error?: string }> {
  if (!isDbAvailable()) {
    return { error: "Base de datos no configurada" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Validation
  if (!name || name.length < 1 || name.length > 60) {
    return { error: "El nombre es obligatorio (máximo 60 caracteres)" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email inválido" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const db = getDb();

  // Check if email already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return {
      error: "Ese email ya tiene cuenta. Probá entrar con Google o con tu contraseña.",
    };
  }

  // Hash and insert
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, name, passwordHash });

  // Attempt auto sign-in
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (err) {
    // signIn throws on redirect; if it's a known auth error, surface friendly message
    if (
      err instanceof Error &&
      (err.message.includes("CredentialsSignin") ||
        err.message.includes("credentials"))
    ) {
      return {
        error: "Cuenta creada, pero no se pudo iniciar sesión. Intentá manualmente.",
      };
    }
    // Other errors (e.g., redirect success) are fine — swallow
  }

  return {};
}
