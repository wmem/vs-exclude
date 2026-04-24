import test from "node:test";
import assert from "node:assert/strict";
import { buildFilesExclude } from "../src/excludeBuilder";

test("buildFilesExclude collapses fully hidden directories", () => {
  const result = buildFilesExclude(
    [
      "src/keep.c",
      "src/private/a.c",
      "src/private/b.c",
      "src/private/nested/c.c",
      "docs/readme.md",
    ],
    new Set(["src/private/a.c", "src/private/b.c", "src/private/nested/c.c", "docs/readme.md"]),
  );

  assert.deepEqual(result, {
    docs: true,
    "src/private": true,
  });
});

test("buildFilesExclude keeps fine-grained entries for mixed directories", () => {
  const result = buildFilesExclude(
    [
      "src/a.c",
      "src/b.c",
      "src/nested/c.c",
      "src/nested/d.c",
    ],
    new Set(["src/a.c", "src/nested/c.c"]),
  );

  assert.deepEqual(result, {
    "src/a.c": true,
    "src/nested/c.c": true,
  });
});

test("buildFilesExclude keeps direct exclude globs without expanding matched files", () => {
  const result = buildFilesExclude(
    [
      "src/main.c",
      "src/generated/a.c",
      "src/generated/b.c",
      "tests/unit/foo.c",
    ],
    new Set([
      "src/generated/a.c",
      "src/generated/b.c",
      "tests/unit/foo.c",
    ]),
    ["src/generated/**", "tests/**", "**/*.tmp"],
  );

  assert.deepEqual(result, {
    "**/*.tmp": true,
    "tests/**": true,
    "src/generated/**": true,
  });
});
