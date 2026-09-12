// Pure validation helpers shared by server actions (and unit-tested standalone).

export function validateDescription(raw: unknown): string {
  const desc = String(raw ?? "").trim();
  if (!desc) throw new Error("La descripción es obligatoria");
  if (desc.length > 120) throw new Error("Máximo 120 caracteres");
  return desc;
}

export function validateAmount(raw: unknown): string {
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

export function validateCategory(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const cat = String(raw).trim();
  if (cat.length > 40) throw new Error("Categoría: máximo 40 caracteres");
  return cat;
}

export function validateDayOfMonth(raw: unknown): number {
  const day = Number(raw);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Día del mes: 1–31");
  }
  return day;
}

// For edits: fixed items may have no anchor day (applies to both quincenas).
export function validateDayOfMonthOptional(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  return validateDayOfMonth(raw);
}

export function validateDate(raw: unknown): string {
  const str = String(raw ?? "").trim();
  const d = new Date(str + "T00:00:00Z");
  if (isNaN(d.getTime())) throw new Error("Fecha inválida");
  return str;
}

// ── Transaction update parsing ───────────────────────────────────────────────

export type UpdateKind =
  | "fixed-income"
  | "fixed-expense"
  | "variable-income"
  | "variable-expense";

const UPDATE_KINDS: UpdateKind[] = [
  "fixed-income",
  "fixed-expense",
  "variable-income",
  "variable-expense",
];

export interface UpdateTransactionInput {
  kind: UpdateKind;
  id: string;
  description: string;
  amount: string;
  category: string | null;
  dayOfMonth: number | null;
  occurredOn: string | null;
}

/** Parses + validates formData for updateTransaction. Pure, throws Error on invalid input. */
export function parseUpdateTransaction(
  formData: FormData
): UpdateTransactionInput {
  const kind = String(formData.get("type") ?? "");
  if (!UPDATE_KINDS.includes(kind as UpdateKind)) {
    throw new Error("Tipo de movimiento inválido");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID requerido");

  return {
    kind: kind as UpdateKind,
    id,
    description: validateDescription(formData.get("description")),
    amount: validateAmount(formData.get("amount")),
    category: validateCategory(formData.get("category")),
    dayOfMonth: kind.startsWith("fixed")
      ? validateDayOfMonthOptional(formData.get("dayOfMonth"))
      : null,
    occurredOn:
      kind.startsWith("variable") ? validateDate(formData.get("occurredOn")) : null,
  };
}
