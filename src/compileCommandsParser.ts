/**
 * compile_commands 纯解析模块，负责提取源码文件与头文件搜索目录。
 */
import * as path from "node:path";
import { normalizeRelativePath, toRelativeWorkspacePath } from "./pathUtils";

interface CompileCommandEntry {
  directory?: string;
  file: string;
  command?: string;
  arguments?: string[];
}

export interface ParsedCompileCommandsResult {
  sourceFiles: Set<string>;
  includeDirectories: Set<string>;
  entryCount: number;
}

/**
 * 解析 compile_commands 文本并提取工作区内的源文件与 include 目录。
 */
export function parseCompileCommandsText(
  content: string,
  workspaceRoot: string,
): ParsedCompileCommandsResult {
  const entries = JSON.parse(content) as CompileCommandEntry[];

  if (!Array.isArray(entries)) {
    throw new Error("compile_commands.json must be a JSON array");
  }

  const sourceFiles = new Set<string>();
  const includeDirectories = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry.file !== "string") {
      continue;
    }

    const workingDirectory = entry.directory
      ? (path.isAbsolute(entry.directory)
        ? path.normalize(entry.directory)
        : path.resolve(workspaceRoot, entry.directory))
      : workspaceRoot;
    const resolvedSourcePath = path.isAbsolute(entry.file)
      ? path.normalize(entry.file)
      : path.resolve(workingDirectory, entry.file);
    const relativeSourcePath = toRelativeWorkspacePath(workspaceRoot, resolvedSourcePath);

    if (relativeSourcePath) {
      sourceFiles.add(relativeSourcePath);
    }

    const args = extractArguments(entry);
    const directories = extractIncludeDirectories(args, workingDirectory, workspaceRoot);

    for (const directoryPath of directories) {
      includeDirectories.add(directoryPath);
    }
  }

  return {
    sourceFiles,
    includeDirectories,
    entryCount: entries.length,
  };
}

/**
 * 从单条编译记录中取出参数数组，兼容 arguments 与 command 两种格式。
 */
function extractArguments(entry: CompileCommandEntry): string[] {
  if (Array.isArray(entry.arguments)) {
    return entry.arguments;
  }

  if (typeof entry.command === "string" && entry.command.trim()) {
    return splitCommandLine(entry.command);
  }

  return [];
}

/**
 * 以最小规则拆分命令行字符串，保留引号和转义的基本语义。
 */
function splitCommandLine(command: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;
  let escaping = false;

  for (const character of command) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }

      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        result.push(current);
        current = "";
      }

      continue;
    }

    current += character;
  }

  if (escaping) {
    current += "\\";
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * 从编译参数中提取 include 搜索目录并转换为工作区相对路径。
 */
function extractIncludeDirectories(
  args: string[],
  workingDirectory: string,
  workspaceRoot: string,
): string[] {
  const results = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const inlineDirectory = readInlineIncludeDirectory(current);

    if (inlineDirectory) {
      const relativeDirectory = resolveIncludeDirectory(
        inlineDirectory,
        workingDirectory,
        workspaceRoot,
      );

      if (relativeDirectory !== undefined) {
        results.add(relativeDirectory);
      }

      continue;
    }

    if (current === "-I" || current === "-isystem" || current === "-iquote") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        continue;
      }

      const relativeDirectory = resolveIncludeDirectory(
        nextValue,
        workingDirectory,
        workspaceRoot,
      );

      if (relativeDirectory !== undefined) {
        results.add(relativeDirectory);
      }

      index += 1;
    }
  }

  return [...results];
}

/**
 * 解析 `-Ifoo`、`-isystemfoo`、`-iquotefoo` 这类内联参数。
 */
function readInlineIncludeDirectory(argument: string): string | undefined {
  const prefixes = ["-I", "-isystem", "-iquote"];

  for (const prefix of prefixes) {
    if (argument.startsWith(prefix) && argument.length > prefix.length) {
      return argument.slice(prefix.length);
    }
  }

  return undefined;
}

/**
 * 把 include 目录解析为工作区内相对路径；工作区外目录会被丢弃。
 */
function resolveIncludeDirectory(
  directoryPath: string,
  workingDirectory: string,
  workspaceRoot: string,
): string | undefined {
  const resolvedPath = path.isAbsolute(directoryPath)
    ? path.normalize(directoryPath)
    : path.resolve(workingDirectory, directoryPath);
  const relativePath = toRelativeWorkspacePath(workspaceRoot, resolvedPath);

  if (relativePath === undefined) {
    return undefined;
  }

  return normalizeRelativePath(relativePath);
}
