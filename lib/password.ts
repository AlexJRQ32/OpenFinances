import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number },
) => Promise<Buffer>;

const KEY_LEN = 64;
const N = 16384;

/**
 * Hash a password with scrypt + random salt.
 * Returns a string in the format: scrypt$<salt hex>$<hash hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN, { N });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 * Returns false for malformed stored values (timing-safe).
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const saltHex = parts[1];
  const expectedHex = parts[2];

  // Validate hex lengths (salt=16 bytes=32 hex chars, hash=64 bytes=128 hex chars)
  if (saltHex.length !== 32 || expectedHex.length !== 128) return false;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(expectedHex)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    const computed = await scryptAsync(password, salt, KEY_LEN, { N });
    return timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}
