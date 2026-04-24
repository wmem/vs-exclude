# 文档总览

`vs-exclude` 用于根据工作区配置和 `compile_commands.json` 自动重建 `files.exclude`，适合超大工程中的“只保留关心文件，屏蔽其余文件”场景。

## 文档列表

- [配置说明](configuration.md)：介绍 `.vscode/settings.json` 中的扩展配置格式、优先级和兼容模式。
- [生成流程](pipeline.md)：说明一次生成任务从扫描文件到写回 `files.exclude` 的完整执行链路。
- [模块说明](modules.md)：按源码文件拆分说明每个模块的职责、输入输出与依赖关系。

## 核心能力

- 读取对象式配置 `vsExclude.config`，并兼容旧拆分配置。
- 解析 `compile_commands.json`，提取编译源文件和 include 搜索目录。
- 在 `header = true` 时保留 include 目录下的 `.h` 文件。
- 通过 `include` / `exclude` 计算最终保留集合。
- 对待隐藏路径做目录折叠，优先生成目录级 `files.exclude` 项。
- 提供命令式触发与日志查看，不依赖状态栏交互。

## 建议阅读顺序

1. 先看 [配置说明](configuration.md) 理解输入。
2. 再看 [生成流程](pipeline.md) 了解整体算法。
3. 最后看 [模块说明](modules.md) 对照源码实现细节。
