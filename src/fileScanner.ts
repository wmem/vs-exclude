/**
 * 工作区扫描模块，负责递归枚举全部文件并统一输出相对路径。
 */
import * as path from "node:path";
import * as vscode from "vscode";
import { normalizePatterns, shouldSkipDirectoryScan } from "./excludePatterns";
import { normalizeRelativePath } from "./pathUtils";

const ALWAYS_SCANNED_FILES = [".vscode/settings.json"];

export interface WorkspaceScanResult {
  files: string[];
  skippedDirectories: string[];
}

/**
 * 深度扫描工作区内所有普通文件，并按字典序返回相对路径列表。
 */
export async function scanWorkspaceFiles(
  workspaceFolder: vscode.WorkspaceFolder,
  excludePatterns: string[] = [],
): Promise<WorkspaceScanResult> {
  const result: WorkspaceScanResult = {
    files: [],
    skippedDirectories: [],
  };
  const normalizedExcludePatterns = normalizePatterns(excludePatterns);

  await walkDirectory(workspaceFolder.uri, workspaceFolder.uri, normalizedExcludePatterns, result);
  result.files.sort((left, right) => left.localeCompare(right));
  result.skippedDirectories.sort((left, right) => left.localeCompare(right));
  return result;
}

/**
 * 递归遍历目录树，只收集普通文件并跳过非文件类型。
 */
async function walkDirectory(
  workspaceRoot: vscode.Uri,
  directory: vscode.Uri,
  excludePatterns: string[],
  result: WorkspaceScanResult,
): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(directory);

  for (const [name, type] of entries) {
    const childUri = vscode.Uri.joinPath(directory, name);
    const relativePath = normalizeRelativePath(path.relative(workspaceRoot.fsPath, childUri.fsPath));

    if (type & vscode.FileType.Directory) {
      if (shouldSkipDirectoryScan(relativePath, excludePatterns, ALWAYS_SCANNED_FILES)) {
        result.skippedDirectories.push(relativePath);
        continue;
      }

      await walkDirectory(workspaceRoot, childUri, excludePatterns, result);
      continue;
    }

    if (!(type & vscode.FileType.File)) {
      continue;
    }

    result.files.push(relativePath);
  }
}
