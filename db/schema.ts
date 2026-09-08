import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────

export const cycleModeEnum = pgEnum("cycle_mode", ["quincenal", "mensual"]);

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
  },
  (table) => [index("variable_expenses_user_id_idx").on(table.userId)]
);
