import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getDb, isDbAvailable } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Whether the Google provider is configured (credentials present). */
export const isGoogleConfigured = !!(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

/**
 * Comma-separated allowlist from ALLOWED_EMAILS.
 * Empty string → empty array.
 */
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Authorization check — open registration with optional allowlist.
 *
 * If ALLOWED_EMAILS is non-empty (comma-separated): only those emails pass
 * (case-insensitive comparison).
 * If ALLOWED_EMAILS is empty or unset: allow ANY authenticated Google account.
 */
async function isEmailAuthorized(email: string): Promise<boolean> {
  const allowed = getAllowedEmails();
  if (allowed.length > 0) {
    return allowed.includes(email);
  }
  return true;
}

/**
 * Upsert user into our users table on first sign-in.
 * Guarded: silently skips when DATABASE_URL is not set.
 */
async function upsertUser(email: string, name?: string | null) {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    await db
      .insert(users)
      .values({ email: email.toLowerCase(), name: name ?? null })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: name ?? users.name },
      });
  } catch (err) {
    // Non-fatal: log but never crash the auth flow.
    console.error("[auth] user upsert failed:", err);
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

const providers: NextAuthConfig["providers"] = [
  ...(isGoogleConfigured ? [Google] : []),
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Contraseña", type: "password" },
    },
    async authorize(credentials) {
      if (!isDbAvailable()) return null;

      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      try {
        const db = getDb();
        const [row] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!row) return null;
        // Google-only account (no password set) cannot sign in with credentials
        if (!row.passwordHash) return null;

        const valid = await verifyPassword(password, row.passwordHash);
        if (!valid) return null;

        return { id: row.id, email: row.email, name: row.name };
      } catch (err) {
        console.error("[auth] credentials authorize error:", err);
        return null;
      }
    },
  }),
];

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, profile, account }) {
      const email = (user.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return false;

      // Authorization check (applies to ALL providers)
      const authorized = await isEmailAuthorized(email);
      if (!authorized) return false;

      // Upsert into our users table on Google sign-in
      if (account?.provider === "google") {
        await upsertUser(email, profile?.name ?? user.name ?? null);
      }
      return true;
    },
    async authorized({ auth }) {
      if (!auth?.user?.email) return false;
      return isEmailAuthorized(auth.user.email.toLowerCase());
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// ── Server-side user helper ──────────────────────────────────────────────────

/** Typed user row returned by getCurrentUser. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  cycleMode: "quincenal" | "mensual";
}

/**
 * Returns the currently authenticated user from the DB.
 * Cached per request via React.cache(). Throws/redirects if not authenticated
 * or user not found in DB. All data access MUST go through this — the client
 * NEVER sends user_id.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  if (!isDbAvailable()) {
    throw new DbNotConfiguredError();
  }

  const db = getDb();
  const email = session.user.email.toLowerCase();

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      cycleMode: users.cycleMode,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!row) {
    // User passed auth gate but has no DB row — shouldn't happen, redirect
    redirect("/auth/signin");
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    cycleMode: row.cycleMode as "quincenal" | "mensual",
  };
});

/** Typed error for when DATABASE_URL is not set. */
export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DbNotConfiguredError";
  }
}
