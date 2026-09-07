import test from "node:test";
import assert from "node:assert/strict";
import { uniqueAuthors, authorInitial } from "../src/lib/authors.ts";

test("lists repeated authors once and sorts Lithuanian letters", () => {
  const names = ["Žemaitė", "Česlovas", "Ąžuolas", "Antanas", "Žemaitė", "Šatrijos Ragana", ""];
  assert.deepEqual(uniqueAuthors(names.map((book_author) => ({ book_author }))),
    ["Antanas", "Ąžuolas", "Česlovas", "Šatrijos Ragana", "Žemaitė"]);
});

test("handles Lithuanian initials, decomposed accents and other initials", () => {
  assert.equal(authorInitial("  žemaitė"), "Ž");
  assert.equal(authorInitial("C\u030ceslovas"), "Č");
  assert.equal(authorInitial("123"), "Kiti");
});
