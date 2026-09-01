# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.43 — 2026-09-01

- 将 `process-control.js` 随首启解压脚本打进安装包，避免便携版和安装版因缺少模块无法初始化官方运行时。

发布标签：[`v1.0.43`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.43)。

## 1.0.42 — 2026-09-01

- 将内置官方 DSH 运行时及其启动依赖升级到 `0.1.2-alpha.3`。
- 将内置生态组件更新到 Codex UI 0.2.97、IM Connect 0.1.30、Archive Manager 0.1.22 和 MCP Connector 0.2.32。
- 强化离线运行时初始化：Windows 冒烟复用共享插件校验器，鉴权与未鉴权路径都等待桌面就绪标记，并在取消或超时解压时清理完整进程树。

发布标签：[`v1.0.42`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.42)。

## 1.0.41 — 2026-08-31

- 修复离线包缺少官方 DSH 启动所需 peer 依赖的问题，确保随包运行时无需联网即可完整启动。
- 将便携版首次运行时的校验、解压和大量文件复制移入独立子进程，并展示分阶段进度，避免初始化期间窗口长时间未响应。
- 将运行时与插件仓库的解压完成标记绑定到随包归档 SHA256；覆盖升级或复用旧便携目录时，空标记和陈旧标记会自动触发重新解压，离线首启不再缺少插件。
- 将 Windows、macOS 与 Linux 打包冒烟测试统一为强制离线，并在隔离 Profile 中核对全部十个随包插件及其固定版本。

发布标签：[`v1.0.41`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.41)。

## 1.0.40 — 2026-08-31

- 将内置官方 DSH 运行时及其启动依赖升级到 `0.1.2-alpha.2`，适配启动 Token 鉴权与 alpha.2 所需的原生安装脚本。
- 将内置生态组件更新到 IM Connect 0.1.27、Skills Manager 0.1.32、Archive Manager 0.1.21、Agency Agents 0.1.23、`dsh-context` 0.38.5、DSH Better Sidebar 0.18.0-alpha.0、MCP Connector 0.2.31 和 `dshmarket` 1.38.1。
- 将 `electron-builder` 升级到 26.15.7，并刷新供全新安装和缺包自修复使用的离线运行时与插件仓库装配流程。
- 让 Windows、macOS 与 Linux 打包应用冒烟测试适配 alpha.2 鉴权：在隔离 Profile 中校验预期的未鉴权响应、进程存活、启动诊断以及主窗口创建后的就绪标记。

发布标签：[`v1.0.40`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.40)。

## 1.0.39 — 2026-08-30

- 为 Ubuntu、Debian 及其他兼容发行版新增原生 Linux ARM64 / aarch64 安装包，同时提供 `.deb` 与 `.AppImage` 制品。
- 新增 GitHub 托管的原生 ARM64 打包任务与打包应用冒烟测试，不依赖未经验证的交叉编译。
- 新增经过校验的 Node.js 24.20.0 Linux ARM64 可执行文件哈希，并在发布前检查架构专属的 `latest-linux-arm64.yml` 更新元数据。
- 更新中英文下载说明、系统要求与开发文档，使 Linux x64 / ARM64 支持保持一致。

发布标签：[`v1.0.39`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.39)。
