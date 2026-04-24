/**
 * 工作区扫描模块，负责递归枚举全部文件并统一输出相对路径。
 */
import * as path from "node:path";
import * as vscode from "vscode";
import { normalizeRelativePath } from "./pathUtils";

/**
 * 深度扫描工作区内所有普通文件，并按字典序返回相对路径列表。
 */
export async function scanWorkspaceFiles(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
  const results: string[] = [];
  await walkDirectory(workspaceFolder.uri, workspaceFolder.uri, results);
  results.sort((left, right) => left.localeCompare(right));
  return results;
}

/**
 * 递归遍历目录树，只收集普通文件并跳过非文件类型。
 */
async function walkDirectory(
  workspaceRoot: vscode.Uri,
  directory: vscode.Uri,
  results: string[],
): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(directory);

  for (const [name, type] of entries) {
    const childUri = vscode.Uri.joinPath(directory, name);

    if (type & vscode.FileType.Directory) {
      await walkDirectory(workspaceRoot, childUri, results);
      continue;
    }

    if (!(type & vscode.FileType.File)) {
      continue;
    }

    const relativePath = normalizeRelativePath(path.relative(workspaceRoot.fsPath, childUri.fsPath));
    results.push(relativePath);
  }
}
