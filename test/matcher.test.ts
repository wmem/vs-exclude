import test from "node:test";
import assert from "node:assert/strict";
import { buildVisibilitySets } from "../src/matcher";

test("buildVisibilitySets keeps include matches compile files and header directories", () => {
  const result = buildVisibilitySets({
    allFiles: [
      "src/main.c",
      "src/other.c",
      "include/main.h",
      "include/private/internal.h",
      "docs/readme.md",
    ],
    includePatterns: ["docs/*.md"],
    excludePatterns: ["include/private/**"],
    compileSourceFiles: ["src/main.c"],
    includeDirectories: ["include"],
    keepHeaderFiles: true,
  });

  assert.deepEqual([...result.keptFiles].sort(), [
    "docs/readme.md",
    "include/main.h",
    "src/main.c",
  ]);
  assert.deepEqual([...result.hiddenFiles].sort(), [
    "include/private/internal.h",
    "src/other.c",
  ]);
});

test("buildVisibilitySets hides all files when nothing is kept", () => {
  const result = buildVisibilitySets({
    allFiles: ["a.c", "b.h"],
    includePatterns: [],
    excludePatterns: [],
    compileSourceFiles: [],
    includeDirectories: [],
    keepHeaderFiles: false,
  });

  assert.equal(result.keptFiles.size, 0);
  assert.deepEqual([...result.hiddenFiles].sort(), ["a.c", "b.h"]);
});

test("buildVisibilitySets always keeps workspace settings file", () => {
  const result = buildVisibilitySets({
    allFiles: [".vscode/settings.json", "src/a.c"],
    includePatterns: [],
    excludePatterns: [".vscode/**"],
    compileSourceFiles: [],
    includeDirectories: [],
    keepHeaderFiles: false,
  });

  assert.deepEqual([...result.keptFiles].sort(), [".vscode/settings.json"]);
  assert.deepEqual([...result.hiddenFiles].sort(), ["src/a.c"]);
});
