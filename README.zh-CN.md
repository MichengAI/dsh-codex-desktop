<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="DSH Codex Desktop 产品横幅" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**下载安装，打开就是可用的本地 AI 工作台。**

[English](README.md) · [下载](https://github.com/MichengAI/dsh-codex-desktop/releases) · [更新日志](CHANGELOG.zh-CN.md) · [反馈问题](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![发布版本](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![许可证](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![桌面端打包](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop 是 DeepSeek Harness 的社区维护桌面发行版，并非 DeepSeek AI 官方产品。

DSH Codex Desktop 将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 封装为原生桌面工作台。安装包已经包含 Node.js 和本地 DSH 运行时：下载安装、打开应用，即可开始使用；不需要自行配置 Node.js 环境，也不必从终端启动 DSH。

## 下载后即可开始

请从 [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases) 下载最新安装包。

| 平台 | 安装包 | 开始方式 |
| --- | --- | --- |
| Windows x64 | `.exe` 安装器或 `.zip` 压缩包 | 运行安装器，然后从开始菜单打开 **DSH Codex Desktop**。 |
| macOS Apple Silicon / Intel | `.dmg` 安装器 | 打开磁盘映像，将应用拖入“应用程序”后启动。 |
| Linux x64 / ARM64 | `.AppImage` 或 Debian / Ubuntu `.deb` | 下载与 CPU 架构匹配的 AppImage，或安装对应的 deb 包后启动应用。 |

1. 下载对应平台的安装包。
2. 安装并打开 **DSH Codex Desktop**。
3. 等待内置的本地 DSH 服务启动完成。
4. 新建任务，选择模型和权限模式，在项目中开始工作。

应用沿用当前用户的 DSH 数据目录（Windows 为 `%USERPROFILE%\.dsh`），升级桌面客户端后，已有会话和配置仍会保留。

## 开箱即用的完整工作台

| 能力 | 你可以直接使用 |
| --- | --- |
| **桌面会话工作区** | 项目和任务导航、会话对话、模型选择、权限模式、会话日志，以及专注的原生桌面窗口。 |
| **专家预设** | 按当前任务启用代码审查、架构、前端、后端、运维等不同专业角色。 |
| **技能中心** | 在设置中查看、启用、停用、上传和管理本地与共享 Agent 技能。 |
| **归档管理** | 搜索已归档会话、按需恢复，或永久清理归档记录。 |
| **IM 助理** | 在一个界面中配置钉钉、飞书、Lark、微信、企业微信、QQ、Telegram 等可用频道。 |
| **插件市场** | 无需离开桌面客户端，即可发现、安装、更新、启用和诊断 DSH 插件。 |
| **MCP 连接器** | 通过 OAuth、API Key、HTTP、stdio 或 JSON 配置添加并管理 MCP 服务。 |
| **定时自动化** | 使用内置 DSH 定时能力，在同一工作台管理周期任务。 |
| **安全的本地运行时** | 应用只在经过校验的本机回环地址启动 DSH，并将 Web 界面承载在桌面壳中。 |

## 产品预览

截图拍摄于 Codex UI 1.1.0（深色主题）；当前内置版本为 1.1.1。会话页为新建测试会话，展示本地指令结果。

<p align="center"><em>首页：从工作区开始新任务。</em></p>

<p align="center"><img src="assets/screenshots/preview-home.webp" alt="首页：从工作区开始新任务。" width="960"></p>

<p align="center"><em>会话页面：对话、轨迹、上下文与任务输入区。</em></p>

<p align="center"><img src="assets/screenshots/preview-conversation.webp" alt="会话页面：对话、轨迹、上下文与任务输入区。" width="960"></p>

<details>
<summary>自研插件页面（6 张）</summary>

<p align="center"><em>专家预设</em></p>

<p align="center"><img src="assets/screenshots/preview-experts.webp" alt="专家预设" width="960"></p>

<p align="center"><em>技能管理</em></p>

<p align="center"><img src="assets/screenshots/preview-skills.webp" alt="技能管理" width="960"></p>

<p align="center"><em>定时任务</em></p>

<p align="center"><img src="assets/screenshots/preview-automation.webp" alt="定时任务" width="960"></p>

<p align="center"><em>IM 助理</em></p>

<p align="center"><img src="assets/screenshots/preview-im-connect.webp" alt="IM 助理" width="960"></p>

<p align="center"><em>归档会话</em></p>

<p align="center"><img src="assets/screenshots/preview-archive.webp" alt="归档会话" width="960"></p>

<p align="center"><em>Codex UI 设置</em></p>

<p align="center"><img src="assets/screenshots/preview-codex-ui.webp" alt="Codex UI 设置" width="960"></p>

</details>

<details>
<summary>社区插件页面（6 张）</summary>

<p align="center"><em>上下文设置</em></p>

<p align="center"><img src="assets/screenshots/preview-context.webp" alt="上下文设置" width="960"></p>

<p align="center"><em>侧边栏设置</em></p>

<p align="center"><img src="assets/screenshots/preview-sidebar.webp" alt="侧边栏设置" width="960"></p>

<p align="center"><em>MCP 连接器</em></p>

<p align="center"><img src="assets/screenshots/preview-mcp-connector.webp" alt="MCP 连接器" width="960"></p>

<p align="center"><em>用量统计</em></p>

<p align="center"><img src="assets/screenshots/preview-usage-billing.webp" alt="用量统计" width="960"></p>

<p align="center"><em>插件市场</em></p>

<p align="center"><img src="assets/screenshots/preview-plugin-market.webp" alt="插件市场" width="960"></p>

<p align="center"><em>Git 提交图谱</em></p>

<p align="center"><img src="assets/screenshots/preview-git-graph.webp" alt="Git 提交图谱" width="960"></p>

</details>

## 首次启动已包含的能力

安装包随附启动 DSH 所需的本地运行时。首次启动时，桌面客户端会为 Web profile 准备以下面向桌面工作流的社区插件：

| 随附能力 | npm 包 |
| --- | --- |
| Codex 风格工作区界面 | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| 原生桌面宠物与会话提醒 | [`@michengai/dsh-codex-pet`](https://github.com/MichengAI/dsh-codex-pet) |
| 专家预设管理 | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| 技能管理 | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| 归档会话管理 | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| IM 助理 | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| 定时自动化 | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |
| 上下文透视与管理 | [`dsh-context`](https://github.com/bowenliang123/dsh-context) |
| 可扩展工作区侧边栏 | [`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) |
| MCP 连接管理 | [`dsh-mcp-connector`](https://github.com/duhu2000/dsh-mcp-connector) |
| 用量与费用统计 | [`@kenz1117/dsh-ui-usage-billing`](https://github.com/kenz1117/dsh-ui-usage-billing) |
| Git 提交图谱 | [`@linxin666/dsh-client-ui-git-graph`](https://github.com/zhu1090093659/dsh-web) |
| 一次性只读旁问 | [`@michengai/dsh-btw`](https://github.com/MichengAI/dsh-btw) |
| Git 变更范围内的代码简化 | [`@michengai/dsh-simplify`](https://github.com/MichengAI/dsh-simplify) |

后续可以在插件市场管理更多插件。桌面应用的运行时与 profile 中安装的社区插件保持隔离，插件变更不会覆盖应用运行时。

桌面桥接能力随应用内置，仅在 Desktop 启动 DSH 时动态注入，无需安装到共享 Web profile。手动运行 `dsh web` 时使用 Web 自身的插件管理通道；旧版遗留的桥接配置会在 Desktop 启动时迁移并备份。

## DSH 产品生态

想直接使用完整工作台，可下载 [DSH Codex Desktop](https://github.com/MichengAI/dsh-codex-desktop/releases)；已有 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 环境，可按需独立安装以下 8 个自研插件。桌面端已随附这些插件。

| 插件 | 你可以用它做什么 |
| --- | --- |
| [Codex UI](https://github.com/MichengAI/dsh-codex-ui) | 整理项目与会话、搜索任务、跳转对话轮次 |
| [IM Connect](https://github.com/MichengAI/dsh-im-connect) | 从微信、飞书、钉钉等消息平台下任务、收回复 |
| [Automation](https://github.com/MichengAI/dsh-automation) | 按计划执行任务，查看每次运行的结果 |
| [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) | 统一查找、启停、创建和导入本机技能 |
| [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) | 搜索、恢复或清理已归档会话 |
| [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | 按任务选择并召唤专业角色 |
| [BTW](https://github.com/MichengAI/dsh-btw) | 在当前上下文中临时旁问，不打断主任务 |
| [Simplify](https://github.com/MichengAI/dsh-simplify) | 用 /simplify 整理 Git 改动范围内的代码 |

桌面端还集成 [DSH Context](https://github.com/bowenliang123/dsh-context)、[DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)、[DSH MCP Connector](https://github.com/duhu2000/dsh-mcp-connector)、[Usage Billing](https://github.com/kenz1117/dsh-ui-usage-billing) 和插件市场，提供上下文、文件导航、连接管理及用量统计。

## 更新与自修复

- **桌面端更新**：默认在启动完成后检查新版本并提醒；可在“设置 → 更新”中改为自动下载或仅手动检查。安装与重启始终需要你明确操作。
- **重新加载 DSH**：修改插件或 profile 配置后，可从托盘菜单重新加载本地 DSH 服务，不需要重装桌面应用。
- **插件更新**：仍在 DSH 设置和插件市场中完成；安装失败的插件不会被激活为运行 bundle。
- **启动自修复**：启动时会移除磁盘上已不存在的社区插件登记，再重试启动本地 DSH。

## 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10/11、macOS 或 Linux |
| 架构 | Windows x64、macOS arm64/x64 或 Linux x64/arm64 |
| Node.js | 终端用户无需安装，应用已内置 |
| 网络 | 仅在使用你配置的模型供应商、插件下载和工具时需要 |

## 隐私与安全

- DSH 配置、会话和凭据保存在当前用户的 DSH 目录中；卸载桌面应用不会删除这些数据。
- 启动器只接受经过校验的 `127.0.0.1` 本地 HTTP 地址供内嵌窗口加载。
- 外部 HTTP(S) 链接由系统浏览器打开；文件、JavaScript 和 data URL 会被拦截。
- DSH 页面已禁用 Node.js 集成，并启用上下文隔离与沙箱。
- 你配置的模型供应商和 DSH 工具可能自行发起网络请求；使用前请核对其设置和隐私政策。

## 开发

### 内置宠物集成

内置 `@michengai/dsh-codex-pet` 0.1.2，随离线资源分发并在首次启动时自动安装；在宠物设置中选择宠物并开启显示，即可启用原生桌面宠物。插件提供 `window.dshPet` v1 接口。Desktop 订阅状态、通过接口转发会话操作，并负责渲染、拖拽、位置存储、鼠标穿透及窗口恢复。宠物插件仍可在浏览器独立使用，不依赖 Desktop；本适配器不支持仅提供旧 `dshDesktopPet` 桥接的版本。

运行 `npm run smoke:pet` 构建并验证真实 Electron 窗口、preload/IPC、多会话审批和问答、过期操作拦截、重载、隐藏及展示接管。测试使用协议与微型图片夹具，只依赖本仓库开发依赖，退出后清理临时用户目录；不能替代已安装插件联调或正式安装包验收。

开发环境需要 Windows、Node.js `24.20.0` 和 pnpm `11.24.0`。

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
pnpm install --frozen-lockfile
pnpm test
pnpm run dist
```

本地构建制品写入 `release\`，不会提交。推送 `vX.Y.Z` 标签后，工作流会打包 Windows x64、macOS arm64/x64，以及 Linux x64/arm64 的 AppImage / deb 制品。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。
