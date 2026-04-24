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
