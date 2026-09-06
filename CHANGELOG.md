# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.48 — 2026-09-07

- Inject the desktop bridge from the application's private directory when Desktop starts DSH. Standalone `dsh web` now uses Web plugin management, and legacy bridge configuration is migrated out of the shared profile with a backup.
- Validate Desktop environment and pnpm availability before exposing bridge services, and keep read-only pnpm queries from modifying the profile.
- Synchronize the Windows taskbar badge with Codex UI's unread records so reading a task clears the same state shown in the task list.
- Respect the updater's availability decision so older or currently ineligible releases are not offered as new updates or downloaded automatically.
- Include pnpm package metadata in the offline bundle so first launch works with an empty user cache. Preserve the initial offline installation error and timeout output for diagnosis.
- Bundle Usage Billing 1.0.31, BTW 0.1.3, and Simplify 0.1.2, bringing the bundled plugin catalog to 13 entries.
- Update Codex UI to 0.2.106, Automation to 0.1.32, `dsh-context` to 0.44.0, and MCP Connector to 0.2.37. Other bundled plugin versions remain unchanged.

Release tag: [`v1.0.48`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.48).

## 1.0.47 — 2026-09-06

- Plugin installation errors now remain separate from DSH startup: the desktop still attempts to load the workbench after a failed installation.
- Recovery identifies only plugins associated with the loading failure, including owners of broken dependencies. Unrelated plugins remain enabled, and candidates are shown before isolation is confirmed.
- Fixed noncritical plugin errors forcing a usable workbench into recovery. Failed plugins still produce diagnostic logs, and restored plugins must pass a complete health check before recovery backups are cleared.
- Retained recovery after a 30-second client loading timeout when recent plugin changes identify possible causes.
- Updated bundled plugins to Codex UI 0.2.103, Automation 0.1.31, Skills Manager 0.1.40, Archive Manager 0.1.30, Agency Agents 0.1.32, `dsh-context` 0.43.0, MCP Connector 0.2.35, and `dshmarket` 1.44.0. IM Connect remains at 0.1.34 and DSH Better Sidebar at 0.18.0.

Release tag: [`v1.0.47`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.47).

## 1.0.46 — 2026-09-04

- Fixed the Windows taskbar unread-completion badge so opening completed tasks clears them permanently; later session-list refreshes no longer count historical completed rows again.

Release tag: [`v1.0.46`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.46).

## 1.0.45 — 2026-09-04

- Added plugin recovery mode: after a failed start the desktop isolates third-party plugins and opens a dedicated page to restore, uninstall, or return to the last healthy configuration.
- Recovery now exits automatically when no plugins remain isolated, and a healthy recovery boot no longer overwrites the last verified configuration checkpoint.
- Fixed a Windows flash when closing the About, Settings, or Shortcuts windows.
- Updated bundled plugins to Codex UI 0.2.102, IM Connect 0.1.34, Automation 0.1.27, Skills Manager 0.1.38, Archive Manager 0.1.29, Agency Agents 0.1.30, `dsh-context` 0.41.2, DSH Better Sidebar 0.18.0, and `dshmarket` 1.41.0.
- Stabilized the runtime-extraction timeout test so macOS Intel CI no longer races a 200ms deadline before the hanging child writes its PID. This supersedes the unreleased `v1.0.44` tag.

Release tag: [`v1.0.45`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.45).

## 1.0.43 — 2026-09-01

- Upgraded the bundled official DSH runtime and its launch peers to `0.1.2-alpha.3`.
- Updated the bundled ecosystem to Codex UI 0.2.97, IM Connect 0.1.30, Archive Manager 0.1.22, and MCP Connector 0.2.32.
- Hardened offline runtime initialization by sharing the bundled-plugin verifier across Windows smoke tests, waiting for the desktop ready marker on both HTTP paths, and cleaning the full extraction process tree when initialization is cancelled or times out.

Release tag: [`v1.0.43`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.43).
