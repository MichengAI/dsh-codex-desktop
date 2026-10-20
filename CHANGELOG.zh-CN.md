# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.88 — 2026-10-21

**修复**

- 插件热重载保护：在插件市场或插件设置中安装、更新、卸载插件时，桌面端会等待安装进程、锁文件以及后续 bundle 校准完全结束并保持静默后再热重载，避免在耗时较长的安装中途提前重启导致插件缺失或进入恢复页。
- 启动期依赖保护：启动与热重载时保留用户在 Web profile 中安装的独立官方插件 bundle 和依赖声明，不再在启动期误删相关依赖。

**适配与升级**

- 内置插件升级到当前最新版：Codex UI 1.1.45、IM Connect 1.0.10、Automation 1.0.5、Skills Manager 1.2.8、Archive Manager 1.1.6、Agency Agents 1.2.8、Codex Pet 1.0.2、dshmarket 1.66.44、Context 0.73.3。BTW 1.0.0、Simplify 1.0.1、Code Review 1.0.1、PUA 1.0.1、Better Sidebar 0.28.0 与官方 DSH 0.2.1-rc.2 已是最新版，本次保持一致。安装包会按这些精确版本装配离线插件。
- 新安装继续随包 Context。费用插件和 MCP 连接器仍不附带，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。

## 1.0.87 — 2026-10-18

**适配与升级**

- 内置 DSH 运行时由 0.2.1-alpha.3 升级到 0.2.1-rc.2，并同步 group、scope、timeout 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.42、IM Connect 1.0.1、Automation 1.0.0、Skills Manager 1.2.5、Archive Manager 1.1.0、Agency Agents 1.2.1、Codex Pet 1.0.1、BTW 1.0.0、Simplify 1.0.1、Code Review 1.0.1、PUA 1.0.1、Better Sidebar 0.28.0、dshmarket 1.66.37、Context 0.73.0。安装包会按这些精确版本装配离线插件。
- 新安装继续随包 Context。费用插件和 MCP 连接器仍不附带，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。

## 1.0.86 — 2026-10-15

**适配与升级**

- 内置 DSH 运行时由 0.2.1-alpha.2 升级到 0.2.1-alpha.3，并同步 scope、timeout 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.40、IM Connect 0.1.77、Automation 0.1.66、Skills Manager 1.1.21、Archive Manager 1.0.19、Agency Agents 1.0.19、Codex Pet 0.1.19、BTW 0.1.24、Simplify 0.1.16、Code Review 0.1.16、PUA 0.3.28、dshmarket 1.66.22、Context 0.72.0。Better Sidebar 0.26.0 已是当前最新版，本次不变。安装包会按这些精确版本装配离线插件。
- 新安装重新附带 Context。费用插件和 MCP 连接器仍不附带，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。

## 1.0.83 — 2026-10-14

**适配与升级**

- 这是 1.0.81 之后的首个发布。
- 内置 DSH 运行时由 0.2.0-rc.2 升级到 0.2.1-alpha.2，并同步 scope、timeout 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.37、IM Connect 0.1.75、Automation 0.1.64、Skills Manager 1.1.19、Archive Manager 1.0.18、Agency Agents 1.0.18、Codex Pet 0.1.18、BTW 0.1.20、Simplify 0.1.15、Code Review 0.1.14、PUA 0.3.27、Better Sidebar 0.26.0、dshmarket 1.66.21。安装包会按这些精确版本装配离线插件。
- 若从 1.0.77 之前的版本升级：新安装仍不附带 Context、费用插件和 MCP 连接器，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。原先无法启动的平台安装包可以正常启动。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。

## 1.0.81 — 2026-10-07

**适配与升级**

- 内置插件升级到当前最新版：Codex UI 1.1.30、IM Connect 0.1.66、Automation 0.1.58、Skills Manager 1.1.13、Archive Manager 1.0.15、Agency Agents 1.0.11、Codex Pet 0.1.15、BTW 0.1.17、Code Review 0.1.12、PUA 0.3.24。Simplify 0.1.14、Better Sidebar 0.24.1、dshmarket 1.66.9 和官方 DSH 0.2.0-rc.2 已是当前最新版，本次不变。安装包会按这些精确版本装配离线插件。
- 若从 1.0.77 之前的版本升级：新安装仍不附带 Context 和费用插件；桌面宠物空闲时会跟着光标转头；从更早版本升级时，离线也能装上配套插件，并保留原有插件配置；Windows 安装包首次启动不再缺少配套插件依赖；原先无法启动的平台安装包可以正常启动。



