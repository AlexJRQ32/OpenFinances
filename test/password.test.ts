import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/password";

describe("password utils", () => {
  it("hash → verify succeeds for correct password", async () => {
    const hash = await hashPassword("mi-password-123");
    assert.ok(hash.startsWith("scrypt$"));
    const ok = await verifyPassword("mi-password-123", hash);
    assert.equal(ok, true);
  });

  it("wrong password fails verification", async () => {
    const hash = await hashPassword("correct-password");
    const ok = await verifyPassword("wrong-password", hash);
    assert.equal(ok, false);
  });

  it("malformed stored value returns false", async () => {
    assert.equal(await verifyPassword("pw", ""), false);
    assert.equal(await verifyPassword("pw", "not-a-hash"), false);
    assert.equal(await verifyPassword("pw", "scrypt$"), false);
    assert.equal(await verifyPassword("pw", "scrypt$abc$def"), false);
    assert.equal(await verifyPassword("pw", "bcrypt$salt$hash"), false);
    // Wrong hex characters
    assert.equal(
      await verifyPassword("pw", "scrypt$ZZZZ$0000"),
      false,
    );
  });

  it("two hashes of the same password differ (unique salt)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    assert.notEqual(h1, h2);
    // But both verify
    assert.equal(await verifyPassword("same-password", h1), true);
    assert.equal(await verifyPassword("same-password", h2), true);
  });
});
