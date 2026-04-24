/**
 * 配置模型模块，负责归一化用户配置并提供基础类型定义。
 */
export interface ExtensionConfig {
  header: boolean;
  include: string[];
  exclude: string[];
  compileCommandsPath?: string;
}

export interface PartialExtensionConfig {
  header?: unknown;
  include?: unknown;
  exclude?: unknown;
  compileCommandsPath?: unknown;
}

/**
 * 过滤未知数组值，只保留字符串项。
 */
function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

/**
 * 读取可选字符串并自动去掉首尾空白。
 */
function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * 把未知值安全地收窄为配置对象；非对象输入统一退化为空对象。
 */
export function asObject(value: unknown): PartialExtensionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as PartialExtensionConfig;
}

/**
 * 合并旧拆分配置与对象配置，并以对象配置为最高优先级。
 */
export function normalizeExtensionConfig(
  legacyConfig: PartialExtensionConfig,
  objectConfig: PartialExtensionConfig,
): ExtensionConfig {
  return {
    header: typeof objectConfig.header === "boolean"
      ? objectConfig.header
      : typeof legacyConfig.header === "boolean"
        ? legacyConfig.header
        : true,
    include: objectConfig.include !== undefined
      ? readStringArray(objectConfig.include)
      : readStringArray(legacyConfig.include),
    exclude: objectConfig.exclude !== undefined
      ? readStringArray(objectConfig.exclude)
      : readStringArray(legacyConfig.exclude),
    compileCommandsPath: objectConfig.compileCommandsPath !== undefined
      ? readOptionalString(objectConfig.compileCommandsPath)
      : readOptionalString(legacyConfig.compileCommandsPath),
  };
}
