# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.30 — 2026-08-25

- 在未配置 Developer ID 证书时，通过构建钩子对 macOS Apple Silicon 与 Intel 完整应用包执行 `codesign --force --deep --sign -`。
- 在上传安装包前严格验证整个 macOS 应用签名，避免再次发布提示“应用已损坏”的 DMG 或 ZIP。
- 将安装目录根图标限定为 Windows 专用，避免无关 ICO 文件进入 macOS 应用包并阻断签名。
- 保留未来 Developer ID 正式签名路径；配置证书后不再使用 ad-hoc 兜底。

发布标签：[`v1.0.30`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.30)。

## 1.0.26 — 2026-08-24

- 新增 Codex 风格桌面壳：返回/前进导航，以及文件、编辑、视图和帮助菜单。
- 新增新建聊天、打开文件夹、聊天切换、键盘快捷键、缩放、全屏、重新加载和托盘控制。
- 丰富“关于”窗口，并统一桌面菜单、托盘和帮助入口的产品文案。
- 修复打开文件夹可能进入错误工作区、查找误点、客户端桥接兜底失效和导航竞态。
- 加固不同渲染窗口的 IPC 权限，并修复 macOS 交通灯安全区和首帧布局。

发布标签：[`v1.0.26`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.26)。

## 1.0.25 — 2026-08-23

- 放大托盘和任务栏图标，提升系统界面的辨识度。

发布标签：[`v1.0.25`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.25)。

## 1.0.24 — 2026-08-23

- 修补内置运行时时保留原始换行符。
- 在 Desktop 运行时中本地化 rc.2 权限界面。

发布标签：[`v1.0.24`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.24)。

## 1.0.23 — 2026-08-22

- 插件更新结果较旧或没有变化时跳过 Desktop 重载。

发布标签：[`v1.0.23`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.23)。
