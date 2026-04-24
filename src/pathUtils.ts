/**
 * 路径工具模块，负责统一工作区内的路径格式与边界判断。
 */
import * as path from "node:path";

/**
 * 把 Windows 风格路径分隔符转换为 POSIX 风格。
 */
export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

/**
 * 规范化工作区相对路径，去除前导 `./`、多余 `/` 和绝对路径前缀。
 */
export function normalizeRelativePath(value: string): string {
  const normalized = toPosixPath(value).replace(/^\.\/+/, "").replace(/^\/+/, "");
  return normalized.replace(/\/+/g, "/");
}

/**
 * 把用户配置的路径解析为绝对路径，支持相对工作区路径与绝对路径。
 */
export function resolveFromWorkspace(workspaceRoot: string, candidate: string): string {
  if (path.isAbsolute(candidate)) {
    return path.normalize(candidate);
  }

  return path.resolve(workspaceRoot, candidate);
}

/**
 * 将绝对路径转换为工作区相对路径；工作区外路径返回 undefined。
 */
export function toRelativeWorkspacePath(
  workspaceRoot: string,
  candidate: string,
): string | undefined {
  const relativePath = path.relative(workspaceRoot, candidate);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  return normalizeRelativePath(relativePath);
}

/**
 * 判断文件是否位于指定相对目录中，兼容目录自身与其子孙路径。
 */
export function isWithinRelativeDirectory(filePath: string, directoryPath: string): boolean {
  if (!directoryPath) {
    return true;
  }

  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}
