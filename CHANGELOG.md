# Changelog

[简体中文](CHANGELOG.zh-CN.md)

The five most recent published versions are listed below.

## 1.0.91 — 2026-10-29

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

## 1.0.87 — 2026-10-18

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.1-alpha.3 to 0.2.1-rc.2, together with group, scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.42, IM Connect 1.0.1, Automation 1.0.0, Skills Manager 1.2.5, Archive Manager 1.1.0, Agency Agents 1.2.1, Codex Pet 1.0.1, BTW 1.0.0, Simplify 1.0.1, Code Review 1.0.1, PUA 1.0.1, Better Sidebar 0.28.0, dshmarket 1.66.37, and Context 0.73.0. The packaged build stages these exact versions.
- New installs continue to bundle Context. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.

## 1.0.86 — 2026-10-15

**Host and bundled plugins**

- The bundled DSH runtime moves from 0.2.1-alpha.2 to 0.2.1-alpha.3, together with scope, timeout and the required launch dependencies.
- Bundled plugins are upgraded to their current latest versions: Codex UI 1.1.40, IM Connect 0.1.77, Automation 0.1.66, Skills Manager 1.1.21, Archive Manager 1.0.19, Agency Agents 1.0.19, Codex Pet 0.1.19, BTW 0.1.24, Simplify 0.1.16, Code Review 0.1.16, PUA 0.3.28, dshmarket 1.66.22, and Context 0.72.0. Better Sidebar 0.26.0 was already the latest version and is unchanged. The packaged build stages these exact versions.
- New installs include Context again. Usage Billing and the MCP connector are still not bundled; a copy you already installed is kept. Official scheduling stays off unless you turn it on, and saved tasks are kept. The desktop pet follows the cursor while idle. Upgrades from older versions can install the bundled plugins offline and keep your existing plugin configuration. A Windows install no longer lacks bundled plugin dependencies the first time it starts. A Windows zip build opens the matching zip; quit and replace the current folder, and do not run the installer.




