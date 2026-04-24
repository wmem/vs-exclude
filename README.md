# vs-exclude

根据 `compile_commands.json` 和工作区配置自动重建 `files.exclude`，适合 Linux 内核这类文件量很大的工程。

## 文档导航

- [文档总览](doc/index.md)
- [配置说明](doc/configuration.md)
- [生成流程](doc/pipeline.md)
- [模块说明](doc/modules.md)

## 配置

推荐在 `.vscode/settings.json` 中使用对象配置：

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

字段说明：
- `header`: 为 `true` 时，保留 `compile_commands.json` 中 include 搜索目录下的 `.h` 文件。
- `include`: 额外保留的文件 glob。
- `exclude`: 直接写入 `files.exclude` 的 glob，同时也会让这些文件不再被视为保留文件。
- `compileCommandsPath`: 可选，自定义 `compile_commands.json` 路径；未设置时默认尝试工作区根目录。

兼容旧配置：

```json
{
  "vsExclude.header": true,
  "vsExclude.include": [],
  "vsExclude.exclude": [],
  "vsExclude.compileCommandsPath": ""
}
```

旧命名空间也仍然兼容：

```json
{
  "vscodeExclude.header": true,
  "vscodeExclude.include": [],
  "vscodeExclude.exclude": [],
  "vscodeExclude.compileCommandsPath": ""
}
```

对象配置会优先于旧的拆分配置。

## 使用

1. 打开目标工作区。
2. 在命令面板执行 `vs-exclude: Generate files.exclude`。
3. 若想查看执行日志，运行 `vs-exclude: Show Log`。

## 行为说明

- 每次执行都会直接覆盖工作区级 `files.exclude`。
- 若指定路径和根目录都没有 `compile_commands.json`，则只按 `include` / `exclude` 计算。
- 当某个目录整棵子树都应隐藏时，会直接生成目录级排除规则，而不是逐文件写入。
- 配置中的 `exclude` 规则会原样写入 `files.exclude`，不会再被扫描结果展开成大量单文件项。
- 生成过程在后台异步执行，长时间扫描时可通过日志查看进度。
- `.vscode/settings.json` 会被强制保留，避免生成后无法继续修改扩展配置。

## 开发

```bash
npm install
npm run compile
npm test
```

在 VS Code 中按 `F5` 可启动扩展开发宿主。

## 打包与离线安装

生成离线安装包：

```bash
npm install
npm run package:vsix
```

打包成功后会在项目根目录生成 `.vsix` 文件，例如 `vs-exclude-0.0.1.vsix`。

离线安装方式：

```bash
code --install-extension vs-exclude-0.0.1.vsix
```

也可以在 VS Code / Cursor 的扩展页中选择 `Install from VSIX...` 手动安装。
