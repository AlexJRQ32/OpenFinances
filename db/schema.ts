import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  varchar,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────

export const cycleModeEnum = pgEnum("cycle_mode", ["quincenal", "mensual"]);

// ── Currency audit columns (v2 USD/CRC) ──────────────────────────────────────
// amount is ALWAYS canonical CRC. For USD entries: originalAmount = USD input,
// exchangeRate = frozen venta rate at create/edit time. Null currency/rate on
// legacy rows = implicit CRC (non-destructive migration).
const currencyCols = () => ({
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 4 }),
});

// ── users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  passwordHash: text("password_hash"),
  cycleMode: text("cycle_mode", { enum: ["quincenal", "mensual"] })
    .notNull()
    .default("quincenal"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── fixed_incomes ────────────────────────────────────────────────────────────

export const fixedIncomes = pgTable(
  "fixed_incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category"),
    dayOfMonth: integer("day_of_month"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...currencyCols(),
  },
  (table) => [index("fixed_incomes_user_id_idx").on(table.userId)]
);

// ── variable_incomes ─────────────────────────────────────────────────────────

export const variableIncomes = pgTable(
  "variable_incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category"),
    occurredOn: date("occurred_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...currencyCols(),
  },
  (table) => [index("variable_incomes_user_id_idx").on(table.userId)]
);

// ── fixed_expenses ───────────────────────────────────────────────────────────

export const fixedExpenses = pgTable(
  "fixed_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category"),
    dayOfMonth: integer("day_of_month"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...currencyCols(),
  },
  (table) => [index("fixed_expenses_user_id_idx").on(table.userId)]
);

// ── variable_expenses ────────────────────────────────────────────────────────

export const variableExpenses = pgTable(
  "variable_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category"),
    occurredOn: date("occurred_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...currencyCols(),
  },
  (table) => [index("variable_expenses_user_id_idx").on(table.userId)]
);
