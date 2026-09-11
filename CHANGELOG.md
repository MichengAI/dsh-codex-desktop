# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## Unreleased

- The startup window now shows measured progress for resource verification, extraction, and dependency syncing, plus plugin installation counts and elapsed time during first launch or upgrades.
- Desktop upgrades now bring older bundled plugins and dependencies up to the packaged baseline while preserving newer versions; bundled plugins can no longer remain pinned below that baseline. Complete packaged resources are preferred, with online retries retained on failure.
- Fix automatic upgrades in existing plugin environments while preserving the original dependency store and user configuration; show a clear message when updates cannot be completed.

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

## 1.0.49 — 2026-09-07

- Clean legacy bridge dependency declarations and package files before seeding plugins on startup, including files left by earlier migrations. File cleanup failures emit a warning and are retried on the next launch without blocking startup; the private dynamically injected bridge remains available.
- Repair bundled plugins listed only in an existing profile's bundle list instead of skipping installation and then removing their entries. Seeding now checks installation declarations in `dependencies`.
- Read pnpm 11 JSON state stored in `.modules.yaml` and preserve the original store when retrying an offline installation online, preventing `ERR_PNPM_UNEXPECTED_STORE`.
- Use the pnpm 11 offline environment setting in smoke tests and verify plugin files, dependency declarations, and bundle activation together.

Release tag: [`v1.0.49`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.49).
