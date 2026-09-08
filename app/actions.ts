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
import { eq } from "drizzle-orm";
import { getCurrentUser, signIn } from "@/auth";
import { hashPassword } from "@/lib/password";

// ── Validation helpers ───────────────────────────────────────────────────────

function validateDescription(raw: unknown): string {
  const desc = String(raw ?? "").trim();
  if (!desc) throw new Error("La descripción es obligatoria");
  if (desc.length > 120) throw new Error("Máximo 120 caracteres");
  return desc;
}

function validateAmount(raw: unknown): string {
  const num = Number(raw);
  if (isNaN(num) || num <= 0) throw new Error("El monto debe ser mayor a 0");
  // Check ≤ 2 decimals
  const str = String(raw);
  const dotIdx = str.indexOf(".");
  if (dotIdx !== -1 && str.length - dotIdx - 1 > 2) {
    throw new Error("Máximo 2 decimales");
  }
  return num.toFixed(2);
}

function validateCategory(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const cat = String(raw).trim();
  if (cat.length > 40) throw new Error("Categoría: máximo 40 caracteres");
  return cat;
}

function validateDayOfMonth(raw: unknown): number {
  const day = Number(raw);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Día del mes: 1–31");
  }
  return day;
}

function validateDate(raw: unknown): string {
  const str = String(raw ?? "").trim();
  const d = new Date(str + "T00:00:00Z");
  if (isNaN(d.getTime())) throw new Error("Fecha inválida");
  return str;
}

// ── Fixed Incomes ────────────────────────────────────────────────────────────

export async function createFixedIncome(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const dayOfMonth = validateDayOfMonth(formData.get("dayOfMonth"));

  const db = getDb();
  await db.insert(fixedIncomes).values({
    userId: user.id,
    description,
    amount,
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
    .where(eq(fixedIncomes.id, id));
  revalidatePath("/");
}

// ── Fixed Expenses ───────────────────────────────────────────────────────────

export async function createFixedExpense(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const dayOfMonth = validateDayOfMonth(formData.get("dayOfMonth"));

  const db = getDb();
  await db.insert(fixedExpenses).values({
    userId: user.id,
    description,
    amount,
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
    .where(eq(fixedExpenses.id, id));
  revalidatePath("/");
}

// ── Variable Incomes ─────────────────────────────────────────────────────────

export async function createVariableIncome(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const occurredOn = validateDate(formData.get("occurredOn"));

  const db = getDb();
  await db.insert(variableIncomes).values({
    userId: user.id,
    description,
    amount,
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
    .where(eq(variableIncomes.id, id));
  revalidatePath("/");
}

// ── Variable Expenses ────────────────────────────────────────────────────────

export async function createVariableExpense(formData: FormData) {
  const user = await getCurrentUser();
  const description = validateDescription(formData.get("description"));
  const amount = validateAmount(formData.get("amount"));
  const category = validateCategory(formData.get("category"));
  const occurredOn = validateDate(formData.get("occurredOn"));

  const db = getDb();
  await db.insert(variableExpenses).values({
    userId: user.id,
    description,
    amount,
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
    .where(eq(variableExpenses.id, id));
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
