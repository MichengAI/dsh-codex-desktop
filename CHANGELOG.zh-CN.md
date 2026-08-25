# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.32 — 2026-08-26

- 新增 `dsh-context` 0.32.0，提供上下文透视与管理；新增 `dsh-better-sidebar` 0.16.1，提供可扩展的工作区侧边栏。
- 将内置 MichengAI 产品更新到 Codex UI 0.2.87、IM Connect 0.1.24、Automation 0.1.18、Skills Manager 0.1.24、Archive Manager 0.1.14 和 Agency Agents 0.1.21。
- 将内置插件市场更新到 `dshmarket` 1.29.2。
- 扩展首次启动离线插件目录，新旧桌面 profile 都会通过既有自修复补种流程获得这两个生态插件。

发布标签：[`v1.0.32`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.32)。

## 1.0.31 — 2026-08-26

- 新增 Codex 风格任务通知，覆盖任务完成、审批和问题提醒，并提供按任务统计的任务栏标记与通知偏好。
- 新增原生内联回复，将输入准确发送回产生通知的任务；Windows Action Center 与冷启动激活也可可靠处理。
- 新增 DSH Codex Desktop 通知身份、紧凑来源图标、带任务名称的标题，以及国际化的“回复”和“关闭”操作。
- 新增独立“通知”设置页，包括带样式的任务完成通知菜单，以及独立的审批和问题通知控制。
- 整个桌面外壳改为跟随 DeepSeek Harness 内部选择的语言，包括菜单、设置、键盘快捷键、关于、托盘、通知、标记和更新对话框。
- 修复任务完成通知错误显示任务最早内容而不是最新助手结果的问题。

发布标签：[`v1.0.31`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.31)。

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
