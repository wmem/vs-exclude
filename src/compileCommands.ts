/**
 * compile_commands 加载模块，负责定位文件并把解析结果接入扩展流程。
 */
import * as vscode from "vscode";
import { ExtensionConfig } from "./configModel";
import { parseCompileCommandsText } from "./compileCommandsParser";
import { resolveFromWorkspace } from "./pathUtils";

export interface CompileCommandsResult {
  compileCommandsPath?: string;
  sourceFiles: Set<string>;
  includeDirectories: Set<string>;
  entryCount: number;
}

/**
 * 加载并解析 compile_commands.json，同时记录关键统计信息。
 */
export async function loadCompileCommands(
  workspaceFolder: vscode.WorkspaceFolder,
  config: ExtensionConfig,
  log: (message: string) => void,
): Promise<CompileCommandsResult> {
  const compileCommandsUri = await locateCompileCommands(workspaceFolder, config, log);

  if (!compileCommandsUri) {
    return {
      sourceFiles: new Set<string>(),
      includeDirectories: new Set<string>(),
      entryCount: 0,
    };
  }

  const fileBytes = await vscode.workspace.fs.readFile(compileCommandsUri);
  const fileText = Buffer.from(fileBytes).toString("utf8");
  const parsed = parseCompileCommandsText(fileText, workspaceFolder.uri.fsPath);

  log(`compile_commands path: ${compileCommandsUri.fsPath}`);
  log(`compile_commands bytes: ${fileBytes.byteLength}`);
  log(`compile_commands entries: ${parsed.entryCount}`);
  log(`compile source files kept: ${parsed.sourceFiles.size}`);
  log(`include search directories in workspace: ${parsed.includeDirectories.size}`);

  return {
    ...parsed,
    compileCommandsPath: compileCommandsUri.fsPath,
  };
}

/**
 * 根据配置或默认路径定位 compile_commands.json。
 */
async function locateCompileCommands(
  workspaceFolder: vscode.WorkspaceFolder,
  config: ExtensionConfig,
  log: (message: string) => void,
): Promise<vscode.Uri | undefined> {
  if (config.compileCommandsPath) {
    const configuredPath = resolveFromWorkspace(
      workspaceFolder.uri.fsPath,
      config.compileCommandsPath,
    );
    const configuredUri = vscode.Uri.file(configuredPath);
    log(`trying configured compile_commands.json: ${configuredPath}`);

    if (await fileExists(configuredUri)) {
      log("configured compile_commands.json found");
      return configuredUri;
    }

    log(`configured compile_commands.json not found: ${configuredPath}`);
    return undefined;
  }

  const defaultUri = vscode.Uri.joinPath(workspaceFolder.uri, "compile_commands.json");
  log(`trying workspace compile_commands.json: ${defaultUri.fsPath}`);

  if (await fileExists(defaultUri)) {
    log("workspace compile_commands.json found");
    return defaultUri;
  }

  log("compile_commands.json not found, use include/exclude rules only");
  return undefined;
}

/**
 * 判断给定 URI 是否存在且为普通文件。
 */
async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return !!(stat.type & vscode.FileType.File);
  } catch {
    return false;
  }
}
