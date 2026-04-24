/**
 * files.exclude 构建模块，负责把隐藏文件集合折叠为目录级规则。
 */
import { matchesAnyPattern, normalizePatterns } from "./excludePatterns";

interface DirectoryNode {
  children: Map<string, DirectoryNode>;
  files: Set<string>;
  fullyHidden: boolean;
}

/**
 * 创建目录树节点，统一节点初始化逻辑。
 */
function createNode(): DirectoryNode {
  return {
    children: new Map<string, DirectoryNode>(),
    files: new Set<string>(),
    fullyHidden: false,
  };
}

/**
 * 根据全部文件、隐藏集合和直接透传的 glob 规则生成最小化的 files.exclude 配置。
 */
export function buildFilesExclude(
  allFiles: string[],
  hiddenFiles: Set<string>,
  directExcludePatterns: string[] = [],
): Record<string, boolean> {
  const normalizedPatterns = normalizePatterns(directExcludePatterns);
  const filteredHiddenFiles = new Set(
    [...hiddenFiles].filter((filePath) => !matchesAnyPattern(filePath, normalizedPatterns)),
  );
  const root = createTree(allFiles);
  markFullyHidden(root, "", filteredHiddenFiles);

  const result: Record<string, boolean> = {};

  for (const pattern of normalizedPatterns) {
    result[pattern] = true;
  }

  collectPatterns(root, "", filteredHiddenFiles, result);
  return result;
}

/**
 * 把扁平文件路径列表组装成目录树，供后续目录折叠判断使用。
 */
function createTree(allFiles: string[]): DirectoryNode {
  const root = createNode();

  for (const filePath of allFiles) {
    const segments = filePath.split("/");
    let current = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const directoryName = segments[index];
      let child = current.children.get(directoryName);

      if (!child) {
        child = createNode();
        current.children.set(directoryName, child);
      }

      current = child;
    }

    current.files.add(segments[segments.length - 1]);
  }

  return root;
}

/**
 * 自底向上判断目录是否整棵子树都应该被隐藏。
 */
function markFullyHidden(
  node: DirectoryNode,
  currentPath: string,
  hiddenFiles: Set<string>,
): boolean {
  let hasContent = node.files.size > 0 || node.children.size > 0;
  let filesAreHidden = true;

  for (const fileName of node.files) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

    if (!hiddenFiles.has(filePath)) {
      filesAreHidden = false;
      break;
    }
  }

  let childrenAreHidden = true;

  for (const [childName, childNode] of node.children) {
    const childPath = currentPath ? `${currentPath}/${childName}` : childName;
    const childFullyHidden = markFullyHidden(childNode, childPath, hiddenFiles);

    hasContent = true;

    if (!childFullyHidden) {
      childrenAreHidden = false;
    }
  }

  node.fullyHidden = hasContent && filesAreHidden && childrenAreHidden;
  return node.fullyHidden;
}

/**
 * 从目录树收集最终输出模式，优先输出已完全隐藏的目录。
 */
function collectPatterns(
  node: DirectoryNode,
  currentPath: string,
  hiddenFiles: Set<string>,
  result: Record<string, boolean>,
): void {
  if (currentPath && node.fullyHidden) {
    result[currentPath] = true;
    return;
  }

  for (const fileName of node.files) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

    if (hiddenFiles.has(filePath)) {
      result[filePath] = true;
    }
  }

  for (const [childName, childNode] of node.children) {
    const childPath = currentPath ? `${currentPath}/${childName}` : childName;
    collectPatterns(childNode, childPath, hiddenFiles, result);
  }
}

