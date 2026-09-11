# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.54 — 2026-09-12

- Desktop upgrades now bring older bundled plugins and dependencies up to the packaged baseline while preserving newer versions, the original dependency store, and user configuration. Offline installation is preferred, with online retries and clear notices for incomplete updates. Bundled plugins can no longer remain below that baseline.
- Startup now shows measured resource verification, extraction, and dependency sync steps, counts, and elapsed time, with faster file copying. The first dependency import may require about 450 MB of additional disk space; duration depends on disk performance.
- Added Developer Tools to the View menu. Use F12 on Windows/Linux or Cmd+Alt+I on macOS to inspect the workspace and recovery pages.
- Updated the automation, archive manager, context, sidebar, MCP connector, and usage billing plugins and their offline dependencies. The Git commit graph plugin is no longer preinstalled; it remains available for separate installation, and existing installations are preserved.

## 1.0.53 — 2026-09-11

- Fix dark title bar and sidebar backgrounds in Windows light mode; Mica now follows light, dark, and system appearance preferences correctly.
- Fix the desktop pet disappearing when first entering a session or navigating within the page, while retaining notification handling and reload recovery.
- Retain the DSH `0.1.5-rc.2` and bundled plugin upgrades. This version uses the Session V3 format. Back up important sessions before upgrading; sessions written by the new version cannot be read directly by older versions.

## 1.0.52 — 2026-09-11

- Upgrade bundled DSH to `0.1.5-rc.2` and update 14 bundled plugins; the plugin market remains on the latest `1.45.1`.
- Adapt to the new DSH startup entry so the desktop app can launch the workspace correctly.
- The new DSH uses the Session V3 format. Back up important conversations before upgrading; conversations written by the new version cannot be read directly by older versions.

## 1.0.51 — 2026-09-09

This update brings a desktop pet and a Git commit graph, along with improvements to window appearance and startup reliability.

- **New desktop pet**: Choose a pet in pet settings and turn on visibility to bring it onto your desktop. Drag it into place, view notifications from multiple conversations, and respond to tool approvals and questions directly.
- **New Git commit graph**: Git Graph is now included, so you can visually explore commit history and branch relationships without installing it separately.
- **More reliable pet display**: Improve recovery after hiding, closing, or an unexpected exit to reduce cases where the pet disappears. Answers are checked against the current questions and options to help prevent actions on changed requests.
- **Updated Windows appearance**: Windows 11 22H2 and later support Mica backgrounds that follow the light or dark theme. Older systems continue to use solid backgrounds.
- **More reliable startup**: Fix page loading failures and HTTP 431 errors that could occur after repeated launches.
- **Updated bundled plugins**: Update 11 plugins covering the workspace UI, experts, skills, archives, IM assistant, scheduled tasks, context, sidebar, MCP connections, usage statistics, and plugin market. The desktop pet and Git Graph are both included in the installer.
- **New feature previews**: Add 14 screenshots to the project README showing the home page, conversations, and plugin settings.

Release tag: [v1.0.51](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.51).

## 1.0.50 — 2026-09-08

- Update bundled plugins to Codex UI 0.2.112, IM Connect 0.1.38, Automation 0.1.34, Skills Manager 0.1.43, Archive Manager 0.1.32, Agency Agents 0.1.34, BTW 0.1.4, `dsh-context` 0.46.0, MCP Connector 0.2.39, Usage Billing 1.0.42, and `dshmarket` 1.45.0. DSH Better Sidebar and Simplify remain at their current latest versions.
- Exclude subagent sessions from taskbar unread counts in both Codex UI unread records and fallback completion tracking, including existing unread entries and sessions whose origin becomes available later.

Release tag: [`v1.0.50`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.50).
