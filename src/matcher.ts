/**
 * 匹配模块，负责根据 include/exclude 与编译结果计算保留和隐藏集合。
 */
import { matchesAnyPattern, normalizePatterns } from "./excludePatterns";
import { isWithinRelativeDirectory, normalizeRelativePath } from "./pathUtils";

const ALWAYS_VISIBLE_FILES = new Set<string>([".vscode/settings.json"]);

export interface MatchInput {
  allFiles: string[];
  includePatterns: string[];
  excludePatterns: string[];
  compileSourceFiles: Iterable<string>;
  includeDirectories: Iterable<string>;
  keepHeaderFiles: boolean;
}

export interface MatchResult {
  keptFiles: Set<string>;
  hiddenFiles: Set<string>;
}

/**
 * 汇总 include、编译单元和头文件目录规则，生成最终可见/隐藏文件集合。
 */
export function buildVisibilitySets(input: MatchInput): MatchResult {
  const allFilesSet = new Set(input.allFiles);
  const keptFiles = new Set<string>();
  const includePatterns = normalizePatterns(input.includePatterns);
  const excludePatterns = normalizePatterns(input.excludePatterns);
  const includeDirectories = [...input.includeDirectories].map(normalizeRelativePath);

  for (const filePath of input.allFiles) {
    if (matchesAnyPattern(filePath, includePatterns)) {
      keptFiles.add(filePath);
    }
  }

  for (const sourceFile of input.compileSourceFiles) {
    if (allFilesSet.has(sourceFile)) {
      keptFiles.add(sourceFile);
    }
  }

  if (input.keepHeaderFiles) {
    for (const filePath of input.allFiles) {
      if (!filePath.endsWith(".h")) {
        continue;
      }

      if (includeDirectories.some((directoryPath) => isWithinRelativeDirectory(filePath, directoryPath))) {
        keptFiles.add(filePath);
      }
    }
  }

  const filesToRemove: string[] = [];

  for (const filePath of keptFiles) {
    if (matchesAnyPattern(filePath, excludePatterns)) {
      filesToRemove.push(filePath);
    }
  }

  for (const filePath of filesToRemove) {
    keptFiles.delete(filePath);
  }

  for (const filePath of ALWAYS_VISIBLE_FILES) {
    if (allFilesSet.has(filePath)) {
      keptFiles.add(filePath);
    }
  }

  const hiddenFiles = new Set<string>();

  for (const filePath of input.allFiles) {
    if (!keptFiles.has(filePath)) {
      hiddenFiles.add(filePath);
    }
  }

  return {
    keptFiles,
    hiddenFiles,
  };
}

