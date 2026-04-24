import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExtensionConfig } from "../src/configModel";

test("normalizeExtensionConfig prefers object-style settings", () => {
  const result = normalizeExtensionConfig(
    {
      header: false,
      include: ["legacy/**"],
      exclude: ["legacy-ignore/**"],
      compileCommandsPath: "legacy/compile_commands.json",
    },
    {
      header: true,
      include: ["src/**"],
      exclude: ["out/**"],
      compileCommandsPath: "build/compile_commands.json",
    },
  );

  assert.deepEqual(result, {
    header: true,
    include: ["src/**"],
    exclude: ["out/**"],
    compileCommandsPath: "build/compile_commands.json",
  });
});

test("normalizeExtensionConfig falls back to legacy settings", () => {
  const result = normalizeExtensionConfig(
    {
      header: false,
      include: ["src/**"],
      exclude: ["ignore/**"],
      compileCommandsPath: "compile_commands.json",
    },
    {},
  );

  assert.deepEqual(result, {
    header: false,
    include: ["src/**"],
    exclude: ["ignore/**"],
    compileCommandsPath: "compile_commands.json",
  });
});
