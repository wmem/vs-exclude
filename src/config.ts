/**
 * VS Code 配置读取模块，负责把工作区设置转换为内部统一配置对象。
 */
import * as vscode from "vscode";
import {
  asObject,
  ExtensionConfig,
  normalizeExtensionConfig,
  PartialExtensionConfig,
} from "./configModel";

/**
 * 从工作区设置读取扩展配置，并兼容对象式与旧拆分式配置。
 */
export function readExtensionConfig(workspaceUri: vscode.Uri): ExtensionConfig {
  const currentConfiguration = vscode.workspace.getConfiguration("vsExclude", workspaceUri);
  const legacyNamespaceConfiguration = vscode.workspace.getConfiguration("vscodeExclude", workspaceUri);
  const legacyConfig: PartialExtensionConfig = {
    header: legacyNamespaceConfiguration.get<boolean>("header"),
    include: legacyNamespaceConfiguration.get<unknown[]>("include"),
    exclude: legacyNamespaceConfiguration.get<unknown[]>("exclude"),
    compileCommandsPath: legacyNamespaceConfiguration.get<string>("compileCommandsPath"),
  };
  const currentLegacyConfig: PartialExtensionConfig = {
    header: currentConfiguration.get<boolean>("header"),
    include: currentConfiguration.get<unknown[]>("include"),
    exclude: currentConfiguration.get<unknown[]>("exclude"),
    compileCommandsPath: currentConfiguration.get<string>("compileCommandsPath"),
  };
  const mergedLegacyConfig = normalizeExtensionConfig(legacyConfig, currentLegacyConfig);
  const legacyObjectConfig = asObject(legacyNamespaceConfiguration.get<unknown>("config"));
  const currentObjectConfig = asObject(currentConfiguration.get<unknown>("config"));
  const objectConfig = normalizeExtensionConfig(legacyObjectConfig, currentObjectConfig);

  return normalizeExtensionConfig(mergedLegacyConfig, objectConfig);
}
