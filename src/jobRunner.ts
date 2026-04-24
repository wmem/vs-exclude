/**
 * 后台任务模块，负责串行执行生成流程并输出运行日志。
 */
import * as vscode from "vscode";
import { readExtensionConfig } from "./config";
import { loadCompileCommands } from "./compileCommands";
import { buildFilesExclude } from "./excludeBuilder";
import { scanWorkspaceFiles } from "./fileScanner";
import { buildVisibilitySets } from "./matcher";

export interface ExcludeJobRunner {
  run: () => void;
  showLog: () => void;
  dispose: () => void;
}

/**
 * 创建单实例任务执行器，避免重复并发生成。
 */
export function createExcludeJobRunner(): ExcludeJobRunner {
  const outputChannel = vscode.window.createOutputChannel("vs-exclude");
  let runningTask: Promise<void> | undefined;

  /**
   * 打开扩展输出面板，便于查看长任务日志。
   */
  const showLog = (): void => {
    outputChannel.show(true);
  };

  /**
   * 启动一次生成任务；如果已有任务在跑则直接复用当前日志面板。
   */
  const run = (): void => {
    if (runningTask) {
      appendLog(outputChannel, "job", "generation request ignored because another job is running");
      void vscode.window.showInformationMessage("vs-exclude is already running.");
      showLog();
      return;
    }

    const startedAt = Date.now();
    appendLog(outputChannel, "job", "accepted generation request");

    runningTask = executeGeneration(outputChannel)
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        appendLog(outputChannel, "error", message);
        void vscode.window.showErrorMessage(`vs-exclude failed: ${message}`);
        showLog();
      })
      .finally(() => {
        const durationMs = Date.now() - startedAt;
        appendLog(outputChannel, "job", `finished in ${durationMs} ms`);
        runningTask = undefined;
      });
  };

  return {
    run,
    showLog,
    dispose: () => {
      outputChannel.dispose();
    },
  };
}

/**
 * 执行完整的扫描、匹配、折叠和写回流程。
 */
async function executeGeneration(outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine("");
  appendLog(outputChannel, "job", "start generation");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error("No workspace folder is open.");
  }

  const scanStartedAt = Date.now();
  const config = readExtensionConfig(workspaceFolder.uri);
  appendLog(outputChannel, "config", `workspace: ${workspaceFolder.uri.fsPath}`);
  appendLog(outputChannel, "config", `header: ${String(config.header)}`);
  appendLog(outputChannel, "config", `include patterns (${config.include.length}): ${formatList(config.include)}`);
  appendLog(outputChannel, "config", `exclude patterns (${config.exclude.length}): ${formatList(config.exclude)}`);
  appendLog(
    outputChannel,
    "config",
    `compileCommandsPath: ${config.compileCommandsPath ?? "<workspace>/compile_commands.json"}`,
  );

  appendLog(outputChannel, "scan", "scanning workspace files");
  const allFiles = await scanWorkspaceFiles(workspaceFolder);
  appendLog(
    outputChannel,
    "scan",
    `workspace files scanned: ${allFiles.length} in ${Date.now() - scanStartedAt} ms`,
  );
  appendLog(outputChannel, "scan", `file samples: ${formatList(allFiles, 5)}`);

  const compileCommandsStartedAt = Date.now();
  appendLog(outputChannel, "compile_commands", "loading compile_commands.json");
  const compileCommands = await loadCompileCommands(workspaceFolder, config, (message) => {
    appendLog(outputChannel, "compile_commands", message);
  });
  appendLog(
    outputChannel,
    "compile_commands",
    `load completed in ${Date.now() - compileCommandsStartedAt} ms`,
  );
  appendLog(
    outputChannel,
    "compile_commands",
    `source file samples: ${formatList(compileCommands.sourceFiles, 5)}`,
  );
  appendLog(
    outputChannel,
    "compile_commands",
    `include directory samples: ${formatList(compileCommands.includeDirectories, 5)}`,
  );

  const matchStartedAt = Date.now();
  appendLog(outputChannel, "match", "building visibility sets");
  const visibility = buildVisibilitySets({
    allFiles,
    includePatterns: config.include,
    excludePatterns: config.exclude,
    compileSourceFiles: compileCommands.sourceFiles,
    includeDirectories: compileCommands.includeDirectories,
    keepHeaderFiles: config.header,
  });
  appendLog(outputChannel, "match", `completed in ${Date.now() - matchStartedAt} ms`);
  appendLog(outputChannel, "match", `kept files: ${visibility.keptFiles.size}`);
  appendLog(outputChannel, "match", `hidden files: ${visibility.hiddenFiles.size}`);
  appendLog(outputChannel, "match", `kept samples: ${formatList(visibility.keptFiles, 5)}`);
  appendLog(outputChannel, "match", `hidden samples: ${formatList(visibility.hiddenFiles, 5)}`);

  const buildStartedAt = Date.now();
  appendLog(outputChannel, "exclude", "building files.exclude payload");
  appendLog(outputChannel, "exclude", `direct exclude patterns: ${formatList(config.exclude, 5)}`);
  const filesExclude = buildFilesExclude(allFiles, visibility.hiddenFiles, config.exclude);
  const filesExcludeKeys = Object.keys(filesExclude);
  appendLog(outputChannel, "exclude", `completed in ${Date.now() - buildStartedAt} ms`);
  appendLog(outputChannel, "exclude", `files.exclude entries: ${filesExcludeKeys.length}`);
  appendLog(outputChannel, "exclude", `entry samples: ${formatList(filesExcludeKeys, 5)}`);

  const writeStartedAt = Date.now();
  appendLog(outputChannel, "write", "writing files.exclude to workspace settings");
  await vscode.workspace
    .getConfiguration("files", workspaceFolder.uri)
    .update("exclude", filesExclude, vscode.ConfigurationTarget.WorkspaceFolder);

  appendLog(outputChannel, "write", `files.exclude updated in ${Date.now() - writeStartedAt} ms`);
  void vscode.window.showInformationMessage("vs-exclude updated files.exclude.");
}

/**
 * 为日志追加统一时间戳和阶段前缀，方便回溯长任务执行链路。
 */
function appendLog(
  outputChannel: vscode.OutputChannel,
  scope: string,
  message: string,
): void {
  outputChannel.appendLine(`[${new Date().toISOString()}] [${scope}] ${message}`);
}

/**
 * 将数组或集合压缩为可读的日志片段，避免输出过长。
 */
function formatList(values: Iterable<string>, limit = 3): string {
  const items = [...values];

  if (items.length === 0) {
    return "<none>";
  }

  if (items.length <= limit) {
    return items.join(", ");
  }

  return `${items.slice(0, limit).join(", ")} ... (+${items.length - limit} more)`;
}
