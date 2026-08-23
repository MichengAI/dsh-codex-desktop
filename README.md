<p align="center">
  <img src="assets/branding/dsh-codex-desktop-banner.webp" alt="DSH Codex Desktop product banner" width="100%">
</p>

<div align="center">

# DSH Codex Desktop

**Download once. Open a ready-to-use local AI workspace.**

[简体中文](README.zh-CN.md) · [Download](https://github.com/MichengAI/dsh-codex-desktop/releases) · [Report an issue](https://github.com/MichengAI/dsh-codex-desktop/issues)

[![Release](https://img.shields.io/github/v/release/MichengAI/dsh-codex-desktop?display_name=tag&label=release)](https://github.com/MichengAI/dsh-codex-desktop/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Desktop package](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml/badge.svg?branch=main)](https://github.com/MichengAI/dsh-codex-desktop/actions/workflows/desktop-package.yml)
![Windows x64](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-000000?logo=apple&logoColor=white)
![Linux x64](https://img.shields.io/badge/Linux-x64-FCC624?logo=linux&logoColor=black)

</div>

> DSH Codex Desktop is a community-maintained desktop distribution of DeepSeek Harness. It is not an official DeepSeek AI product.

DSH Codex Desktop turns [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) into a native, ready-to-run desktop workbench. The installer includes the required Node.js runtime and local DSH runtime: install it, open it, then start working. You do not need to prepare a Node.js environment or launch DSH from a terminal.

## Download and start

Get the current installer from [GitHub Releases](https://github.com/MichengAI/dsh-codex-desktop/releases).

| Platform | Package | Start here |
| --- | --- | --- |
| Windows x64 | `.exe` installer or `.zip` archive | Run the installer, then open **DSH Codex Desktop** from the Start menu. |
| macOS Apple Silicon / Intel | `.dmg` installer | Open the disk image, move the app to Applications, then launch it. |
| Linux x64 | `.AppImage` or Debian / Ubuntu `.deb` | Run the AppImage or install the deb package, then launch the app. |

1. Download the package for your platform.
2. Install and open **DSH Codex Desktop**.
3. Wait for the built-in local DSH service to finish starting.
4. Create a task, select a model and permission mode, then work in your project.

The application keeps DSH data in your existing user profile (`%USERPROFILE%\.dsh` on Windows), so sessions and settings remain available after application upgrades.

## Latest runtime and model support

This release updates the bundled runtime and the desktop plugin set:

- **DeepSeek Harness `0.1.1-rc.2`** — includes the current DeepSeek provider integration and model catalog.
- **DeepSeek-V4-Pro / V4-Flash** — available from the model picker after you configure a DeepSeek API key. DeepSeek's V4 release provides 1M context and both thinking and non-thinking modes; select `deepseek-v4-pro` for complex work or `deepseek-v4-flash` for faster responses. See the [official V4 announcement](https://deepseek.com/news/v4-preview/) and [API model reference](https://api-docs.deepseek.com/).
- **DeepSeek-V4-Flash-Vision-Exp** — the bundled DSH adapter includes the experimental visual model (`deepseek-v4-flash-vision-exp`) with text and image input. Select it when a task needs screenshot, image, or document understanding; image attachments are sent as native image inputs instead of being flattened into text.
- **Desktop plugins** — Codex UI `0.2.66` and `dshmarket` `1.17.1` are bundled, while IM Connect `0.1.13`, Automation `0.1.5`, Skills Manager `0.1.23`, Archive Manager `0.1.12`, and Agency Agents `0.1.20` remain current.

> Vision is an experimental DeepSeek model. API availability, limits, and billing are controlled by DeepSeek and may change; use the standard V4 models when an image is not required.

## A complete desktop workbench

| Capability | What you get |
| --- | --- |
| **Desktop conversation workspace** | Project and task navigation, conversation sessions, model selection, permissions, session logs, and a focused desktop window. |
| **Expert presets** | Enable specialist roles for code review, architecture, frontend, backend, operations, and other workflows. |
| **Skill center** | Inspect, enable, disable, upload, and manage local and shared Agent skills from Settings. |
| **Archive management** | Search archived conversations, restore a session when needed, or permanently remove archived records. |
| **IM assistant** | Configure DingTalk, Feishu, Lark, WeChat, WeCom, QQ, Telegram, and other available channels in one place. |
| **Plugin market** | Discover, install, update, enable, and diagnose DSH plugins without leaving the desktop client. |
| **Scheduled automation** | Use the built-in DSH scheduling capability to manage recurring tasks from the same workspace. |
| **Safe local runtime** | The app starts DSH on a validated loopback address and keeps the browser UI inside the desktop shell. |

## Product preview

<p align="center"><em>Dark workspace: project context, a long-running task, and the desktop conversation surface.</em></p>

<p align="center"><img src="assets/screenshots/desktop-conversation-dark.png" alt="DSH Codex Desktop dark conversation workspace" width="960"></p>

<p align="center"><em>Light workspace: the same task surface in the light theme.</em></p>

<p align="center"><img src="assets/screenshots/desktop-conversation-light.png" alt="DSH Codex Desktop light conversation workspace" width="960"></p>

<p align="center"><em>Archived conversations stay searchable and can be restored from Settings.</em></p>

<p align="center"><img src="assets/screenshots/desktop-archive.png" alt="Archived conversation management" width="960"></p>

<p align="center"><em>Manage the skills available to DSH and your Agents.</em></p>

<p align="center"><img src="assets/screenshots/desktop-skills.png" alt="Skill management" width="960"></p>

<p align="center"><em>Connect channels for IM-assisted workflows.</em></p>

<p align="center"><img src="assets/screenshots/desktop-im-channels.png" alt="IM channel configuration" width="960"></p>

<p align="center"><em>Enable only the expert presets that match the current task.</em></p>

<p align="center"><img src="assets/screenshots/desktop-experts.png" alt="Expert preset management" width="960"></p>

## Included on first launch

The installer ships with the local runtime required to start DSH. On first launch, it prepares the desktop-facing community plugins in the Web profile:

| Included capability | Package |
| --- | --- |
| Codex-style workspace UI | [`@michengai/dsh-codex-ui`](https://github.com/MichengAI/dsh-codex-ui) |
| Expert preset management | [`@michengai/dsh-agency-agents`](https://github.com/MichengAI/dsh-agency-agents) |
| Skill management | [`@michengai/dsh-skills-manager`](https://github.com/MichengAI/dsh-skills-manager) |
| Archive management | [`@michengai/dsh-archive-manager`](https://github.com/MichengAI/dsh-archive-manager) |
| IM assistant | [`@michengai/dsh-im-connect`](https://github.com/MichengAI/dsh-im-connect) |
| Scheduled automation | [`@michengai/dsh-automation`](https://github.com/MichengAI/dsh-automation) |

You can later manage additional plugins from the plugin market. The desktop application keeps its own runtime separate from profile-installed community plugins so plugin changes do not overwrite the application runtime.

## DSH product ecosystem

DSH Codex Desktop combines the core runtime, feature products, and plugin market into a ready-to-install desktop product. The same products can also be used separately for other DSH setups:

| Product | Primary role | Relationship to the desktop app |
| --- | --- | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | Models, sessions, tools, and plugin runtime | The core runtime bundled and started by the desktop app |
| **DSH Codex Desktop** | Cross-platform workbench for end users | This product, responsible for ready-to-run installation, updates, and recovery |
| [DSH Codex Suite](https://github.com/MichengAI/dsh-codex-ui/tree/main/packages/dsh-codex-suite) | One-click feature suite for existing DSH Web environments | Installs the same six feature products without the desktop runtime |
| Six feature products | [Codex UI](https://github.com/MichengAI/dsh-codex-ui) · [IM Connect](https://github.com/MichengAI/dsh-im-connect) · [Automation](https://github.com/MichengAI/dsh-automation) · [Skills Manager](https://github.com/MichengAI/dsh-skills-manager) · [Archive Manager](https://github.com/MichengAI/dsh-archive-manager) · [Agency Agents](https://github.com/MichengAI/dsh-agency-agents) | Each can be installed independently; all six are bundled with the desktop app |
| `dshmarket` | Discover, install, and update more DSH plugins | Included as the plugin market |

## Updates and recovery

- **Desktop updates** are manual: use the tray menu to check for a new desktop version, download it, then choose install and restart.
- **DSH reload** is available from the tray menu after changing plugins or profile configuration; it restarts the local DSH service without reinstalling the desktop application.
- **Plugin updates** remain in the DSH settings and plugin market. A failed plugin installation is not activated as a running bundle.
- **Startup recovery** removes stale community-plugin registrations that no longer have an installed package, then retries the local DSH startup.

## System requirements

| Item | Requirement |
| --- | --- |
| Operating system | Windows 10/11, macOS, or Linux |
| Architecture | Windows x64, macOS arm64/x64, or Linux x64 |
| Node.js | Not required for end users; bundled with the application |
| Network | Required only for the model providers, plugin downloads, and tools you choose to use |

## Privacy and security

- DSH configuration, sessions, and credentials remain in the current user's DSH directory. Uninstalling the desktop app does not delete them.
- The launcher accepts only validated `127.0.0.1` local HTTP addresses for its embedded window.
- External HTTP(S) links open in the system browser. File, JavaScript, and data URLs are blocked.
- Electron uses context isolation and sandboxing, with Node.js integration disabled for the DSH page.
- Your configured model providers and DSH tools may make their own network requests. Review their settings and privacy policies before use.

## Development

Development requires Windows, Node.js `24.19.0`, and pnpm `11.22.0`.

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
pnpm install --frozen-lockfile
pnpm test
pnpm run dist
```

Local build artifacts are written to `release\` and are not committed. Pushing a `vX.Y.Z` tag starts the packaging workflow for Windows x64, macOS arm64/x64, and Linux x64 AppImage / deb artifacts.

## Project documentation

For current status, architecture constraints, and iteration records, start at the [documentation entry point](docs/00-交接入口/00-阅读导航.md).

## License

This project is licensed under [Apache License 2.0](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the five most recent releases.
