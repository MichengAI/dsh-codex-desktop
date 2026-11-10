# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.94 — 2026-11-10

**Internationalization and multi-language support**

- Comprehensive support for 8 languages across the desktop shell: Simplified Chinese, English, Japanese, Spanish, French, German, Russian, and Portuguese.
- Auxiliary windows (Settings, Keyboard Shortcuts, About, Startup Progress, and Self-Healing Recovery Mode), system tray menus, desktop notifications, and action buttons automatically follow your active language.
- Full product and ecosystem documentation now available in 8 language editions.

**Bundled plugins**

- Bundled plugins are upgraded to their latest versions: Codex UI 2.0.21, IM Connect 1.0.34, Automation 1.0.22, Skills Manager 1.4.0, Archive Manager 1.3.1, Agency Agents 1.2.27, Codex Pet 1.0.14, BTW 1.3.7, Simplify 1.0.8, Code Review 1.0.9, PUA 1.0.10, Better Sidebar 0.30.1, dshmarket 1.73.17, and Context 0.83.1. The packaged build stages these exact versions.
- New installs continue to bundle Context. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration.

## 1.0.93 — 2026-11-05

**Host and bundled plugins**

- The bundled DSH runtime moves to 0.2.2-rc.1, together with group (1.1.0), scope (0.2.2-rc.1), timeout (0.2.2-rc.1) and the required launch dependencies.
- Bundled plugins are upgraded to their latest versions: Codex UI 2.0.19, IM Connect 1.0.27, Automation 1.0.18, Skills Manager 1.2.33, Archive Manager 1.2.8, Agency Agents 1.2.26, Codex Pet 1.0.13, BTW 1.3.3, Simplify 1.0.7, Code Review 1.0.8, PUA 1.0.8, Better Sidebar 0.30.1, dshmarket 1.73.11, and Context 0.82.0. The packaged build stages these exact versions.
- New installs continue to bundle Context. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration.

## 1.0.92 — 2026-10-29

**Host and bundled plugins**

- This is the first release after 1.0.89.
- The bundled DSH runtime moves from 0.2.1-rc.3 to 0.2.2-alpha.2, together with group, scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 2.0.4, IM Connect 1.0.20, Automation 1.0.13, Skills Manager 1.2.22, Archive Manager 1.1.18, Agency Agents 1.2.18, Codex Pet 1.0.7, BTW 1.3.0, Simplify 1.0.5, Code Review 1.0.5, PUA 1.0.5, Better Sidebar 0.28.2, dshmarket 1.73.3, and Context 0.78.0. The packaged build stages these exact versions.
- Packaging smoke check resilience: Provides a dedicated readiness timeout once the background server is healthy, preventing smoke timeouts on slower virtualization environments during first-start dependency seeding.
- New installs continue to bundle Context. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.89 — 2026-10-25

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.1-rc.2 to 0.2.1-rc.3, together with group, scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.49, IM Connect 1.0.17, Automation 1.0.10, Skills Manager 1.2.18, Archive Manager 1.1.12, Agency Agents 1.2.13, Codex Pet 1.0.6, BTW 1.0.8, Simplify 1.0.4, Code Review 1.0.3, and PUA 1.0.3. Better Sidebar 0.28.0, dshmarket 1.66.44, and Context 0.73.3 remain unchanged.

## 1.0.88 — 2026-10-21

**Fixes**

- Plugin reload protection: When installing, updating, or removing plugins via the marketplace or settings, the desktop shell now waits for in-flight operations, writer locks, and post-install bundle calibrations to completely settle before reloading DSH, preventing premature restarts during longer installations from causing missing plugins or landing on the recovery page.
- Startup dependency protection: Preserves user-installed official plugin bundles and dependency declarations in the Web profile across cold starts and reloads, preventing startup routines from inadvertently removing installed packages.

**Host and bundled plugins**

- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.45, IM Connect 1.0.10, Automation 1.0.5, Skills Manager 1.2.8, Archive Manager 1.1.6, Agency Agents 1.2.8, Codex Pet 1.0.2, dshmarket 1.66.44, and Context 0.73.3. BTW 1.0.0, Simplify 1.0.1, Code Review 1.0.1, PUA 1.0.1, Better Sidebar 0.28.0, and official DSH 0.2.1-rc.2 were already the latest versions and remain unchanged. The packaged build stages these exact versions.
- New installs continue to bundle Context. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.




