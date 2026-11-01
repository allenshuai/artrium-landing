import assert from "node:assert/strict";
import test from "node:test";

import {
  EMAIL_MAX,
  FORMULA_PREFIX,
  NAME_MAX,
  clean,
  isValidEmail,
  validateWaitlistInput,
} from "./validation";

const EMAIL_DOMAIN = "@example.com";

/** A well-formed address exactly `length` characters long. */
function emailOfLength(length: number): string {
  return "a".repeat(length - EMAIL_DOMAIN.length) + EMAIL_DOMAIN;
}

function errorOf(body: unknown): string | null {
  const result = validateWaitlistInput(body);
  // `=== false` narrows without strictNullChecks, which the test build runs without.
  return result.ok === false ? result.error : null;
}

test("a well-formed body passes, cleaned", () => {
  assert.deepEqual(validateWaitlistInput({ name: "  Ada Lovelace ", email: " ada@example.com\n" }), {
    ok: true,
    name: "Ada Lovelace",
    email: "ada@example.com",
  });
});

test("anything but a JSON object is an invalid request", () => {
  for (const body of [null, undefined, [], ["a@b.c"], "a@b.c", 42, true]) {
    assert.equal(errorOf(body), "Invalid request.", JSON.stringify(body));
  }
});

test("a missing, empty or non-string name or email is refused", () => {
  for (const body of [
    {},
    { name: "Ada" },
    { email: "ada@example.com" },
    { name: "", email: "ada@example.com" },
    { name: "   ", email: "ada@example.com" },
    { name: "Ada", email: "\u0000\u0007" },
    { name: 42, email: "ada@example.com" },
    { name: "Ada", email: ["ada@example.com"] },
  ]) {
    assert.equal(errorOf(body), "Missing name or email.", JSON.stringify(body));
  }
});

test("the name is capped after cleaning", () => {
  assert.equal(validateWaitlistInput({ name: "n".repeat(NAME_MAX), email: "a@b.c" }).ok, true);
  assert.equal(
    validateWaitlistInput({ name: `  ${"n".repeat(NAME_MAX)}\u0000  `, email: "a@b.c" }).ok,
    true,
    "surrounding space and control characters do not count"
  );
  assert.equal(
    errorOf({ name: "n".repeat(NAME_MAX + 1), email: "a@b.c" }),
    `Name must be ${NAME_MAX} characters or fewer.`
  );
});

test("the email is capped at the address limit", () => {
  assert.equal(isValidEmail(emailOfLength(EMAIL_MAX)), true);
  assert.equal(isValidEmail(emailOfLength(EMAIL_MAX + 1)), false);
  assert.equal(errorOf({ name: "Ada", email: emailOfLength(EMAIL_MAX + 1) }), "Enter a valid email address.");
});

test("addresses with one @ and a dotted domain of non-empty labels pass", () => {
  for (const email of ["a@b.c", "first.last+tag@mail.example.co.uk", "o'brien@example.ie", "x_y@sub-domain.example.org"]) {
    assert.equal(isValidEmail(email), true, email);
    assert.equal(validateWaitlistInput({ name: "Ada", email }).ok, true, email);
  }
});

test("malformed addresses are refused by the check and by the body validation", () => {
  for (const email of [
    "a@b.c.", // trailing dot: an empty last label
    "a@b",
    "a@.b.c",
    "a@b..c",
    "a@b.c..",
    ".@",
    "@b.c",
    "a@",
    "a@@b.c",
    "a@b@c.d",
    "a b@c.d",
    "a@b c.d",
    "plainaddress",
  ]) {
    assert.equal(isValidEmail(email), false, email);
    assert.equal(errorOf({ name: "Ada", email }), "Enter a valid email address.", email);
  }
});

test("isValidEmail expects a cleaned value: surrounding space fails it", () => {
  assert.equal(isValidEmail(" a@b.c"), false);
  assert.equal(isValidEmail("a@b.c "), false);
  assert.equal(validateWaitlistInput({ name: "Ada", email: " a@b.c " }).ok, true);
});

test("a name or email that a sheet would read as a formula is refused", () => {
  const refused = "Name and email cannot start with =, +, - or @.";
  for (const prefix of ["=", "+", "-", "@"]) {
    assert.equal(FORMULA_PREFIX.test(prefix + "x"), true, prefix);
    assert.equal(errorOf({ name: `${prefix}SUM(A1:A9)`, email: "a@b.c" }), refused, `name ${prefix}`);
  }
  for (const email of ["=a@b.c", "+a@b.c", "-a@b.c"]) {
    assert.equal(errorOf({ name: "Ada", email }), refused, email);
  }
});

test("the formula check runs after cleaning, so leading space or controls do not hide a prefix", () => {
  const refused = "Name and email cannot start with =, +, - or @.";
  assert.equal(errorOf({ name: "   =HYPERLINK(\"x\")", email: "a@b.c" }), refused);
  assert.equal(errorOf({ name: "\u0000\t=1+1", email: "a@b.c" }), refused);
  assert.equal(errorOf({ name: "Ada", email: "\u0001-a@b.c" }), refused);
});

test("the prefix characters are fine anywhere but the start", () => {
  assert.deepEqual(validateWaitlistInput({ name: "Mary-Jane O+Neil = me@home", email: "a-b+c=d@b.c" }), {
    ok: true,
    name: "Mary-Jane O+Neil = me@home",
    email: "a-b+c=d@b.c",
  });
});

test("clean strips C0, DEL and C1 control characters and trims", () => {
  assert.equal(clean("  Ada\u0000 Love\u007flace\u0085\u009f  "), "Ada Lovelace");
  assert.equal(clean("a\tb\nc\rd"), "abcd");
  assert.equal(clean("\u001b[31mred\u001b[0m"), "[31mred[0m");
  assert.equal(clean("Zoë 李"), "Zoë 李", "non-control characters are kept");
});

test("clean turns anything but a string into an empty string", () => {
  for (const value of [undefined, null, 0, 42, true, {}, [], ["a"]]) {
    assert.equal(clean(value), "", JSON.stringify(value));
  }
});
