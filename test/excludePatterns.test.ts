import test from "node:test";
import assert from "node:assert/strict";
import { normalizePatterns, shouldSkipDirectoryScan } from "../src/excludePatterns";

test("shouldSkipDirectoryScan skips directories matched by exact and subtree exclude rules", () => {
  const patterns = normalizePatterns(["node_modules", "**/vendor/**"]);

  assert.equal(shouldSkipDirectoryScan("node_modules", patterns), true);
  assert.equal(shouldSkipDirectoryScan("third_party/vendor", patterns), true);
});

test("shouldSkipDirectoryScan does not skip directories for file-only exclude rules", () => {
  const patterns = normalizePatterns(["src/**/*.tmp", "build/*.log"]);

  assert.equal(shouldSkipDirectoryScan("src", patterns), false);
  assert.equal(shouldSkipDirectoryScan("build", patterns), false);
});

test("shouldSkipDirectoryScan keeps protected settings directory scannable", () => {
  const patterns = normalizePatterns([".vscode", ".vscode/**"]);

  assert.equal(shouldSkipDirectoryScan(".vscode", patterns, [".vscode/settings.json"]), false);
});
