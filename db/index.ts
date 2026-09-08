import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy singleton — does NOT throw at import time if DATABASE_URL is missing.
// The connection is only created on first use.

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Cannot connect to the database."
    );
  }
  const client = postgres(url);
  return drizzle(client, { schema });
}

/**
 * Returns the Drizzle DB client. Throws only when called (not at import time)
 * if DATABASE_URL is missing, so the app can still build without a DB.
 */
export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

/**
 * Returns true when DATABASE_URL is configured and a DB client can be created.
 * Useful for guarding optional DB-dependent code paths (e.g. user upsert on sign-in).
 */
export function isDbAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}
