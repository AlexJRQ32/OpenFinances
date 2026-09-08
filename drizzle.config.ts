import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local so DATABASE_URL is available when running drizzle-kit CLI.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
