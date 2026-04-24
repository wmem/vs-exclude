/**
 * 扩展入口模块，只负责注册命令并绑定任务执行器。
 */
import * as vscode from "vscode";
import { createExcludeJobRunner } from "./jobRunner";

/**
 * 激活扩展并注册生成与日志查看命令。
 */
export function activate(context: vscode.ExtensionContext): void {
  const jobRunner = createExcludeJobRunner();

  context.subscriptions.push(
    { dispose: () => jobRunner.dispose() },
    vscode.commands.registerCommand("vsExclude.generate", () => {
      jobRunner.run();
    }),
    vscode.commands.registerCommand("vsExclude.showLog", () => {
      jobRunner.showLog();
    }),
  );
}

/**
 * 扩展停用时无需额外清理，由 subscriptions 自动释放资源。
 */
export function deactivate(): void {}
