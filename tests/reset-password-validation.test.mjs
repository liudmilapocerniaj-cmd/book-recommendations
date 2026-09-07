import test from "node:test";
import assert from "node:assert/strict";
import { validateResetPassword } from "../src/lib/reset-password-validation.ts";

test("rejects empty, whitespace-only, short and mismatched passwords", () => {
  for (const [password, confirmation] of [["", ""], ["        ", "        "], ["1234567", "1234567"], ["abcdefgh", "abcdefgi"], ["abcdefgh", ""]]) {
    assert.equal(typeof validateResetPassword(password, confirmation), "string");
  }
});

test("accepts matching passwords of at least eight characters without trimming them", () => {
  assert.equal(validateResetPassword("abcde123", "abcde123"), null);
  assert.equal(validateResetPassword(" abcde123 ", " abcde123 "), null);
  assert.notEqual(validateResetPassword(" abcde123 ", "abcde123"), null);
});
