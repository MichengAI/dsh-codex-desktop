# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

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
