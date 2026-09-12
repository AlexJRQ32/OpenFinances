import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

interface OwnableTable {
  id: PgColumn;
  userId: PgColumn;
}

/**
 * WHERE clause that scopes any read/write to both the row id AND the session user.
 * Every mutation on user-owned rows must go through this — never filter by id alone.
 */
export function ownershipWhere(
  table: OwnableTable,
  id: string,
  userId: string
): SQL {
  return and(eq(table.id, id), eq(table.userId, userId)) as SQL;
}
