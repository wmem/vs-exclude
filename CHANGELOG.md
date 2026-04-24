# Changelog

All notable changes to `vs-exclude` will be documented in this file.

## 0.0.1

- Initial release of `vs-exclude`.
- Generate `files.exclude` from `compile_commands.json`, `include`, and `exclude` rules.
- Preserve `.vscode/settings.json` to keep configuration editable after generation.
- Support object-style `vsExclude.config` settings while remaining compatible with legacy `vscodeExclude.*` keys.
- Provide background execution and detailed logs through `vsExclude.showLog`.
