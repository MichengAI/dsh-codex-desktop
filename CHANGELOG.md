# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.36 — 2026-08-27

- Updated the bundled desktop runtime to Node.js 24.20.0 and pnpm 11.24.0, including verified executable checksums for every supported platform.
- Updated the desktop toolchain to Electron 44.0.0, TypeScript 7.0.2, `@electron/notarize` 3.1.1, and `@types/node` 26.4.0.
- Updated Codex UI to 0.2.89, Automation to 0.1.21, Skills Manager to 0.1.25, Archive Manager to 0.1.16, `dsh-context` to 0.33.1, MCP Connector to 0.2.24, and `dshmarket` to 1.31.1.
- Updated the packaging workflow to the current major releases of Checkout, Setup Node, pnpm Setup, Upload Artifact, and Download Artifact; all other direct and bundled dependencies were verified as current.

Release tag: [`v1.0.36`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.36).

## 1.0.35 — 2026-08-26

- Removed Electron's native menu bar from Desktop Settings, Keyboard Shortcuts, and About windows so pressing Alt can no longer reveal an English `File / Edit / View / Window` menu over the localized desktop shell.

Release tag: [`v1.0.35`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.35).

## 1.0.34 — 2026-08-26

- Added `dsh-mcp-connector` 0.2.21 to the bundled offline catalog for OAuth, API-key, HTTP, stdio, and JSON-based MCP connection management.
- Added a dedicated Updates settings page with automatic check-and-notify, automatic download with install confirmation, and manual-only policies.
- Added a delayed, non-blocking startup update check for packaged builds. New versions notify in the background, while installation and restart always require an explicit user action.
- Updated Codex UI to 0.2.88 and refreshed compatible development dependencies.
- Aligned community-store assembly with the Web profile's isolated official-runtime model so prerelease DSH peers are not duplicated into the plugin profile.

Release tag: [`v1.0.34`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.34).

## 1.0.33 — 2026-08-26

- Added a product preview showing `dsh-context` context management alongside the DSH Better Sidebar file explorer.
- Retried transient Windows file replacement failures so profile updates are not interrupted by short-lived file locks.

Release tag: [`v1.0.33`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.33).

## 1.0.32 — 2026-08-26

- Added `dsh-context` 0.32.0 for context inspection and management, and `dsh-better-sidebar` 0.16.1 for an extensible workspace sidebar.
- Updated the bundled MichengAI products to Codex UI 0.2.87, IM Connect 0.1.24, Automation 0.1.18, Skills Manager 0.1.24, Archive Manager 0.1.14, and Agency Agents 0.1.21.
- Updated the bundled plugin market to `dshmarket` 1.29.2.
- Extended the offline first-launch catalog so new and existing desktop profiles receive the two ecosystem plugins through the normal self-healing seed path.

Release tag: [`v1.0.32`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.32).
