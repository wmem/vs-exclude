/**
 * 后台任务模块，负责串行执行生成流程并输出运行日志。
 */
import { parse } from "jsonc-parser";
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

interface GenerationProgressReporter {
  report: (message: string) => void;
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

    runningTask = Promise.resolve(
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "vs-exclude",
          cancellable: false,
        },
        async (progress) => {
          const progressReporter: GenerationProgressReporter = {
            report: (message: string) => {
              progress.report({ message });
            },
          };

          progressReporter.report("正在准备生成 files.exclude...");
          await executeGeneration(outputChannel, progressReporter);
        },
      ),
    )
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
async function executeGeneration(
  outputChannel: vscode.OutputChannel,
  progressReporter: GenerationProgressReporter,
): Promise<void> {
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
  progressReporter.report("正在扫描工作区文件...");
  const scanResult = await scanWorkspaceFiles(workspaceFolder, config.exclude);
  const allFiles = scanResult.files;
  appendLog(
    outputChannel,
    "scan",
    `workspace files scanned: ${allFiles.length} in ${Date.now() - scanStartedAt} ms`,
  );
  appendLog(
    outputChannel,
    "scan",
    `excluded directories skipped: ${scanResult.skippedDirectories.length}`,
  );
  appendLog(outputChannel, "scan", `file samples: ${formatList(allFiles, 5)}`);
  appendLog(outputChannel, "scan", `skipped directory samples: ${formatList(scanResult.skippedDirectories, 5)}`);

  const compileCommandsStartedAt = Date.now();
  appendLog(outputChannel, "compile_commands", "loading compile_commands.json");
  progressReporter.report("正在读取 compile_commands.json...");
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
  progressReporter.report("正在计算保留与隐藏文件...");
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
  progressReporter.report("正在生成 files.exclude 规则...");
  appendLog(outputChannel, "exclude", `direct exclude patterns: ${formatList(config.exclude, 5)}`);
  const filesExclude = buildFilesExclude(allFiles, visibility.hiddenFiles, config.exclude);
  const filesExcludeKeys = Object.keys(filesExclude);
  appendLog(outputChannel, "exclude", `completed in ${Date.now() - buildStartedAt} ms`);
  appendLog(outputChannel, "exclude", `files.exclude entries: ${filesExcludeKeys.length}`);
  appendLog(outputChannel, "exclude", `entry samples: ${formatList(filesExcludeKeys, 5)}`);

  const writeStartedAt = Date.now();
  appendLog(outputChannel, "write", "writing files.exclude to workspace settings");
  progressReporter.report("正在写入 .vscode/settings.json...");
  const writeResult = await writeFilesExcludeToSettings(workspaceFolder, filesExclude);
  appendLog(outputChannel, "write", `settings path: ${writeResult.settingsPath.fsPath}`);
  appendLog(outputChannel, "write", `read settings in ${writeResult.readDurationMs} ms`);
  appendLog(
    outputChannel,
    "write",
    `current settings bytes: ${writeResult.previousByteLength}, current files.exclude entries: ${writeResult.previousExcludeEntryCount}`,
  );
  appendLog(outputChannel, "write", `prepared new settings in ${writeResult.prepareDurationMs} ms`);
  appendLog(
    outputChannel,
    "write",
    `new settings bytes: ${writeResult.nextByteLength}, new files.exclude entries: ${writeResult.nextExcludeEntryCount}`,
  );
  appendLog(outputChannel, "write", `wrote settings file in ${writeResult.writeDurationMs} ms`);
  appendLog(outputChannel, "write", `write mode: ${writeResult.changed ? "updated" : "skipped (no change)"}`);

  appendLog(outputChannel, "write", `files.exclude updated in ${Date.now() - writeStartedAt} ms`);
  progressReporter.report("已完成，正在收尾...");
  void vscode.window.showInformationMessage("vs-exclude updated files.exclude.");
}

interface WriteFilesExcludeResult {
  changed: boolean;
  previousByteLength: number;
  nextByteLength: number;
  previousExcludeEntryCount: number;
  nextExcludeEntryCount: number;
  readDurationMs: number;
  prepareDurationMs: number;
  writeDurationMs: number;
  settingsPath: vscode.Uri;
}

/**
 * 直接更新工作区 `.vscode/settings.json` 中的 `files.exclude`，并保留其他配置。
 */
async function writeFilesExcludeToSettings(
  workspaceFolder: vscode.WorkspaceFolder,
  filesExclude: Record<string, boolean>,
): Promise<WriteFilesExcludeResult> {
  const vscodeDirectory = vscode.Uri.joinPath(workspaceFolder.uri, ".vscode");
  const settingsPath = vscode.Uri.joinPath(vscodeDirectory, "settings.json");

  await vscode.workspace.fs.createDirectory(vscodeDirectory);

  const readStartedAt = Date.now();
  const existingText = await readJsoncFile(settingsPath);
  const readDurationMs = Date.now() - readStartedAt;
  const previousByteLength = new TextEncoder().encode(existingText).byteLength;

  const prepareStartedAt = Date.now();
  const currentDocument = parse(existingText) as Record<string, unknown> | undefined;
  const currentFilesExclude = isObject(currentDocument?.["files.exclude"])
    ? currentDocument["files.exclude"]
    : undefined;
  const previousExcludeEntryCount = isObject(currentFilesExclude)
    ? Object.keys(currentFilesExclude).length
    : 0;

  if (stableStringify(currentFilesExclude) === stableStringify(filesExclude)) {
    const prepareDurationMs = Date.now() - prepareStartedAt;
    return {
      changed: false,
      previousByteLength,
      nextByteLength: previousByteLength,
      previousExcludeEntryCount,
      nextExcludeEntryCount: previousExcludeEntryCount,
      readDurationMs,
      prepareDurationMs,
      writeDurationMs: 0,
      settingsPath,
    };
  }

  const updatedText = applyFilesExcludeToSettings(existingText, filesExclude);
  const prepareDurationMs = Date.now() - prepareStartedAt;
  const encodedText = new TextEncoder().encode(updatedText);
  const writeStartedAt = Date.now();
  await vscode.workspace.fs.writeFile(settingsPath, encodedText);
  const writeDurationMs = Date.now() - writeStartedAt;

  return {
    changed: true,
    previousByteLength,
    nextByteLength: encodedText.byteLength,
    previousExcludeEntryCount,
    nextExcludeEntryCount: Object.keys(filesExclude).length,
    readDurationMs,
    prepareDurationMs,
    writeDurationMs,
    settingsPath,
  };
}

/**
 * 基于已解析的配置对象重建 settings.json，并仅替换 `files.exclude`。
 */
function applyFilesExcludeToSettings(
  settingsText: string,
  filesExclude: Record<string, boolean>,
): string {
  const parsedSettings = parse(settingsText || "{}") as Record<string, unknown> | undefined;
  const settingsObject = isObject(parsedSettings) ? parsedSettings : {};
  const normalizedEol = settingsText.includes("\r\n") ? "\r\n" : "\n";
  const nextSettings = {
    ...settingsObject,
    "files.exclude": filesExclude,
  };

  return `${JSON.stringify(nextSettings, null, 4)}${normalizedEol}`;
}

/**
 * 读取 JSONC 文件文本；如果文件不存在则返回空对象文本。
 */
async function readJsoncFile(filePath: vscode.Uri): Promise<string> {
  try {
    const fileBytes = await vscode.workspace.fs.readFile(filePath);
    return new TextDecoder().decode(fileBytes);
  } catch (error: unknown) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return "{}\n";
    }

    throw error;
  }
}

/**
 * 判断未知值是否为普通对象，供设置比较逻辑使用。
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 稳定序列化对象，避免键顺序影响“是否有变化”的判断。
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * 递归排序对象键，确保比较结果稳定。
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortValue(entryValue)]),
    );
  }

  return value;
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
