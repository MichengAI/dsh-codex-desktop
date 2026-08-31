# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.41 — 2026-08-31

- Fixed the offline bundle so it includes every peer required to launch the official DSH runtime without network access.
- Moved portable first-run verification, extraction, and bulk file copying into a separate child process with staged progress, preventing the window from becoming unresponsive during initialization.
- Bound runtime and plugin-store completion markers to the bundled archive SHA256. Empty or stale markers from overwritten or reused portable directories now trigger re-extraction, so offline first launch no longer starts without plugins.
- Made Windows, macOS, and Linux packaged-app smoke tests force offline mode and verify all ten bundled plugins and their pinned versions in an isolated profile.

Release tag: [`v1.0.41`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.41).

## 1.0.40 — 2026-08-31

- Upgraded the bundled official DSH runtime and its launch peers to `0.1.2-alpha.2`, including authenticated startup-token handling and the alpha.2 native-script requirements.
- Updated the bundled ecosystem to IM Connect 0.1.27, Skills Manager 0.1.32, Archive Manager 0.1.21, Agency Agents 0.1.23, `dsh-context` 0.38.5, DSH Better Sidebar 0.18.0-alpha.0, MCP Connector 0.2.31, and `dshmarket` 1.38.1.
- Upgraded `electron-builder` to 26.15.7 and refreshed the offline runtime and plugin-store assembly for fresh installs and missing-package repair.
- Aligned Windows, macOS, and Linux packaged-app smoke tests with alpha.2 authentication by verifying the expected unauthenticated response, process liveness, startup diagnostics, and the post-window ready marker in isolated profiles.

Release tag: [`v1.0.40`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.40).

## 1.0.39 — 2026-08-30

- Added native Linux ARM64 / aarch64 packages for Ubuntu, Debian, and other compatible distributions, with both `.deb` and `.AppImage` artifacts.
- Added a native GitHub-hosted ARM64 packaging job and packaged-app smoke test instead of relying on unverified cross-compilation.
- Added the verified Node.js 24.20.0 Linux ARM64 executable checksum and a release guard for the architecture-specific `latest-linux-arm64.yml` update metadata.
- Updated the English and Chinese download, system-requirement, and development documentation for Linux x64 / ARM64 parity.

Release tag: [`v1.0.39`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.39).

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
