# 生成流程

一次生成任务由命令 `vsExclude.generate` 触发，在后台异步运行，并通过 Output Channel 输出日志。

## 执行步骤

1. 读取工作区配置。
2. 扫描工作区全部文件。
3. 定位并解析 `compile_commands.json`。
4. 计算保留集合。
5. 计算隐藏集合。
6. 折叠目录并生成 `files.exclude`。
7. 将结果完整写回工作区配置。

## 详细说明

### 1. 读取配置

`src/config.ts` 会读取工作区配置并交给 `src/configModel.ts` 做归一化处理。

得到的内部配置结构为：

- `header`
- `include`
- `exclude`
- `compileCommandsPath`

### 2. 扫描工作区文件

`src/fileScanner.ts` 递归扫描工作区中的所有普通文件，并统一输出为使用 `/` 的相对路径列表。

这样后续：

- glob 匹配更稳定
- Windows / Linux 路径差异被抹平
- 目录折叠逻辑可以直接基于相对路径树工作

### 3. 解析 compile_commands

`src/compileCommands.ts` 负责定位 `compile_commands.json`，`src/compileCommandsParser.ts` 负责解析其内容。

解析结果包括：

- 编译源文件列表
- include 搜索目录列表
- 编译条目数量

支持两种记录格式：

- `arguments`
- `command`

### 4. 计算保留集合

`src/matcher.ts` 会综合以下来源构造保留集合：

- `include` 命中的文件
- `compile_commands.json` 里的源文件
- 当 `header = true` 时，include 搜索目录下的 `.h` 文件

然后再应用 `exclude`，从保留集合中删除命中的文件；这些 `exclude` glob 本身会直接透传到最终的 `files.exclude`。

### 5. 计算隐藏集合

隐藏集合的定义很直接：

`全部文件 - 保留文件 = 隐藏文件`

这个集合是后续写入 `files.exclude` 的基础。

### 6. 目录折叠

`src/excludeBuilder.ts` 会把隐藏文件集合转换成目录树，并自底向上判断：

- 如果一个目录下所有文件和子目录都应该隐藏，则输出目录规则。
- 如果目录中仍有需要保留的文件，则保留更细粒度的文件级规则。
- 如果某些隐藏文件已经被配置中的 `exclude` glob 覆盖，则不会再额外展开成单文件项。

这样在大工程中可以显著减少 `files.exclude` 项数量。

### 7. 写回配置

最终会直接更新工作区 `.vscode/settings.json` 中的 `files.exclude` 字段：

```ts
// preserve other settings, only replace `files.exclude`
settings["files.exclude"] = filesExclude;
```

注意：

- 这里会完整覆盖旧的 `files.exclude` 项。
- 其他设置项会被保留，不会被插件改写。
- 由于会整体重写 `settings.json` 文本，原有注释和手工格式会被规范化。

## 日志与并发控制

`src/jobRunner.ts` 使用单实例任务执行器保证同一时间只运行一个生成任务。

日志会记录：

- 开始时间
- 触发与阶段切换时间戳
- 当前配置摘要
- 扫描文件数量
- 文件与规则样本
- 是否找到 `compile_commands.json`
- 解析出的编译单元数量
- 保留文件数量
- 最终 `files.exclude` 条目数
- 写回配置耗时
- 完成时间
