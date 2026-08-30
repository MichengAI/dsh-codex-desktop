# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.38 — 2026-08-30

- Updated the six bundled MichengAI products to Codex UI 0.2.94, IM Connect 0.1.26, Automation 0.1.22, Skills Manager 0.1.31, Archive Manager 0.1.19, and Agency Agents 0.1.22.
- Updated the bundled ecosystem components to `dsh-context` 0.38.3, DSH Better Sidebar 0.17.1, MCP Connector 0.2.29, and `dshmarket` 1.38.0.
- Refreshed the offline plugin catalog used by fresh installs and missing-package repair. Existing profiles can apply the same versions through the plugin market without the desktop silently overriding user-selected package versions.
- Kept the bundled official DSH runtime on the current npm release, 0.1.1-rc.2; the source-only 0.1.2 Alpha remains outside the stable desktop channel.

Release tag: [`v1.0.38`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.38).

## 1.0.37 — 2026-08-27

- Synced the light and dark desktop title bars with the Codex-style gradient and the active DSH color scheme, including Desktop Settings, Keyboard Shortcuts, and About windows.
- Cleared native title-bar menu selection after a dismissed popup, so menu buttons no longer remain visually active after clicking elsewhere.
- Restored Escape behavior across the DSH view and desktop settings: ordinary DSH popups keep their own Escape handling, while only the visible Settings dialog is closed by the desktop fallback.
- Made marketplace bulk updates wait for the complete batch before recycling the DSH runtime, with a bounded timeout and safe reload fallback.

Release tag: [`v1.0.37`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.37).

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
