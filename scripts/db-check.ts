import { getDb } from "../db/index";
import { sql } from "drizzle-orm";

async function main() {
  const [row] = await getDb().execute(
    sql`select count(*)::int as n from users`
  );
  console.log("DB OK, users:", row.n);
  process.exit(0);
}

main();
