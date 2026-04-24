/**
 * exclude 模式工具，统一处理路径归一化和 glob 匹配语义。
 */
import { minimatch } from "minimatch";
import { normalizeRelativePath } from "./pathUtils";

const DIRECTORY_PROBE_NAME = "__vs_exclude_probe__";

/**
 * 清洗用户输入的 glob 模式并统一成相对路径格式。
 */
export function normalizePatterns(patterns: string[]): string[] {
  return [...new Set(
    patterns
      .map((pattern) => normalizeRelativePath(pattern.trim()))
      .filter((pattern) => pattern.length > 0),
  )];
}

/**
 * 判断路径是否命中任一 glob 模式。
 */
export function matchesAnyPattern(candidatePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern === candidatePath) {
      return true;
    }

    return minimatch(candidatePath, pattern, { dot: true });
  });
}

/**
 * 判断目录是否应在扫描阶段直接跳过。
 *
 * 只要目录自身，或其任意直接/后代路径会被 exclude 规则整体覆盖，就不再继续递归扫描。
 * 对于必须保留可见的目录（例如 `.vscode/settings.json` 所在目录），则始终保留扫描。
 */
export function shouldSkipDirectoryScan(
  directoryPath: string,
  patterns: string[],
  alwaysScannedFiles: Iterable<string> = [],
): boolean {
  const normalizedDirectory = normalizeRelativePath(directoryPath);

  if (!normalizedDirectory) {
    return false;
  }

  for (const protectedFilePath of alwaysScannedFiles) {
    if (
      protectedFilePath === normalizedDirectory
      || protectedFilePath.startsWith(`${normalizedDirectory}/`)
    ) {
      return false;
    }
  }

  if (matchesAnyPattern(normalizedDirectory, patterns)) {
    return true;
  }

  return matchesAnyPattern(`${normalizedDirectory}/${DIRECTORY_PROBE_NAME}`, patterns);
}
