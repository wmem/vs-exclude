import test from "node:test";
import assert from "node:assert/strict";
import { parseCompileCommandsText } from "../src/compileCommandsParser";

test("parseCompileCommandsText resolves source files and include directories", () => {
  const workspaceRoot = "/workspace/project";
  const content = JSON.stringify([
    {
      directory: "/workspace/project/build",
      file: "../src/main.c",
      arguments: [
        "clang",
        "-I",
        "../include",
        "-isystem../third_party/system",
        "-iquote",
        "../generated",
        "../src/main.c",
      ],
    },
    {
      directory: "/workspace/project",
      file: "src/other.c",
      command: "clang -I include -c src/other.c",
    },
  ]);

  const result = parseCompileCommandsText(content, workspaceRoot);

  assert.deepEqual([...result.sourceFiles].sort(), ["src/main.c", "src/other.c"]);
  assert.deepEqual([...result.includeDirectories].sort(), [
    "generated",
    "include",
    "third_party/system",
  ]);
  assert.equal(result.entryCount, 2);
});
