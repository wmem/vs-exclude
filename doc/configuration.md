# 配置说明

扩展优先从 `.vscode/settings.json` 读取 `vsExclude.config` 对象配置；若对象配置缺失，则回退到 `vsExclude.*` 拆分配置；旧的 `vscodeExclude.*` 命名空间也继续兼容。

## 推荐配置

```json
{
  "vsExclude.config": {
    "header": true,
    "include": [
      "drivers/net/**",
      "include/linux/**/*.h"
    ],
    "exclude": [
      "**/test/**"
    ],
    "compileCommandsPath": "build/compile_commands.json"
  }
}
```

## 字段含义

### `header`

- 类型：`boolean`
- 默认值：`true`
- 含义：是否保留 `compile_commands.json` 中 include 搜索目录下的 `.h` 文件。

说明：这里不会解析真实头文件依赖图，而是按照编译参数里的 `-I`、`-isystem`、`-iquote` 目录统一保留头文件。

### `include`

- 类型：`string[]`
- 默认值：`[]`
- 含义：额外保留的文件 glob 规则。

示例：

```json
{
  "vsExclude.config": {
    "include": [
      "drivers/net/**",
      "arch/arm64/include/**/*.h"
    ]
  }
}
```

### `exclude`

- 类型：`string[]`
- 默认值：`[]`
- 含义：直接写入最终 `files.exclude` 的 glob 规则，同时这些规则命中的文件不会再被视为保留文件。

示例：

```json
{
  "vsExclude.config": {
    "exclude": [
      "**/test/**",
      "**/*.tmp"
    ]
  }
}
```

说明：

- 这些规则会直接作为 `files.exclude` 的键写入工作区配置。
- 如果某个目录已被这些规则整体覆盖，扫描阶段会直接跳过该目录，不再继续递归读取其内容。
- 扫描阶段如果发现某个文件已经被 `exclude` 规则覆盖，就不会再为它生成额外的单文件排除项。
- `.vscode/settings.json` 所在目录会保留扫描，避免扩展把自己的工作区配置也一并跳过。

### `compileCommandsPath`

- 类型：`string`
- 默认值：空字符串
- 含义：自定义 `compile_commands.json` 路径。

解析规则：

- 配置为绝对路径时，直接使用该路径。
- 配置为相对路径时，以工作区根目录为基准解析。
- 未配置时，默认尝试工作区根目录下的 `compile_commands.json`。
- 两者都不存在时，仅根据 `include` / `exclude` 计算保留集合。

## 旧配置兼容

当前命名空间的拆分配置写法：

```json
{
  "vsExclude.header": true,
  "vsExclude.include": [],
  "vsExclude.exclude": [],
  "vsExclude.compileCommandsPath": ""
}
```

旧命名空间也仍兼容：

```json
{
  "vscodeExclude.header": true,
  "vscodeExclude.include": [],
  "vscodeExclude.exclude": [],
  "vscodeExclude.compileCommandsPath": ""
}
```

优先级规则：

1. `vsExclude.config.*`
2. `vsExclude.*`
3. `vscodeExclude.config.*`
4. `vscodeExclude.*`
5. 代码默认值
