# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.39 — 2026-08-30

- 为 Ubuntu、Debian 及其他兼容发行版新增原生 Linux ARM64 / aarch64 安装包，同时提供 `.deb` 与 `.AppImage` 制品。
- 新增 GitHub 托管的原生 ARM64 打包任务与打包应用冒烟测试，不依赖未经验证的交叉编译。
- 新增经过校验的 Node.js 24.20.0 Linux ARM64 可执行文件哈希，并在发布前检查架构专属的 `latest-linux-arm64.yml` 更新元数据。
- 更新中英文下载说明、系统要求与开发文档，使 Linux x64 / ARM64 支持保持一致。

发布标签：[`v1.0.39`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.39)。

## 1.0.38 — 2026-08-30

- 将内置的六个 MichengAI 产品更新到 Codex UI 0.2.94、IM Connect 0.1.26、Automation 0.1.22、Skills Manager 0.1.31、Archive Manager 0.1.19 和 Agency Agents 0.1.22。
- 将内置生态组件更新到 `dsh-context` 0.38.3、DSH Better Sidebar 0.17.1、MCP Connector 0.2.29 和 `dshmarket` 1.38.0。
- 刷新供全新安装和缺包自修复使用的离线插件目录；已有 Profile 可通过插件市场升级到相同版本，桌面端不会静默覆盖用户主动选择的插件版本。
- 官方 DSH 运行时继续使用 npm 当前版本 0.1.1-rc.2；仅提供源码的 0.1.2 Alpha 暂不进入桌面稳定通道。

发布标签：[`v1.0.38`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.38)。

## 1.0.37 — 2026-08-27

- 让浅色和深色桌面标题栏同步 Codex 风格渐变与当前 DSH 配色，并覆盖“桌面端设置”“键盘快捷键”和“关于”窗口。
- 原生标题栏菜单关闭后会清除选中状态，点击菜单外部不再留下视觉上的激活样式。
- 恢复 DSH 视图和桌面设置窗口的 Escape 行为：普通 DSH 弹层继续自行处理 Escape，桌面兜底仅关闭可见的“设置”对话框。
- 插件市场批量更新会等待整个批次完成后再重启 DSH 运行时，并加入有界超时和安全重载回退。

发布标签：[`v1.0.37`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.37)。

## 1.0.36 — 2026-08-27

- 将桌面端内置运行时更新到 Node.js 24.20.0 与 pnpm 11.24.0，并校验全部支持平台的可执行文件哈希。
- 将桌面工具链更新到 Electron 44.0.0、TypeScript 7.0.2、`@electron/notarize` 3.1.1 与 `@types/node` 26.4.0。
- 将 Codex UI 更新到 0.2.89、Automation 更新到 0.1.21、Skills Manager 更新到 0.1.25、Archive Manager 更新到 0.1.16、`dsh-context` 更新到 0.33.1、MCP Connector 更新到 0.2.24，并将 `dshmarket` 更新到 1.31.1。
- 将打包工作流升级到 Checkout、Setup Node、pnpm Setup、Upload Artifact 与 Download Artifact 的当前主版本；其余直接依赖和内置依赖也已核对为最新版。

发布标签：[`v1.0.36`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.36)。

## 1.0.35 — 2026-08-26

- 移除“桌面端设置”“键盘快捷键”和“关于”窗口中的 Electron 原生菜单栏，按下 Alt 时不再在已经国际化的桌面外壳上方显示英文 `File / Edit / View / Window` 菜单。

发布标签：[`v1.0.35`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.35)。
