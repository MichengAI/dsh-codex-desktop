# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.68 — 2026-09-24

- 首次启动按随包锁文件离线安装内置插件，不再按依赖范围重新解析。新发布的传递依赖，例如 lucide-react 1.48.0，不会再挡住离线启动。

## 1.0.67 — 2026-09-24

- 桌面端 v2 宠物在空闲时会跟着光标转头。原生窗口轮询屏幕光标；网页浮层不变。
- 内置官方 DSH 运行时由 0.1.6-alpha.2 升级至 0.1.7-rc.1，并同步 scope、timeout、invariants。cordis-plugin-group 由 1.0.2 升至 1.0.4，否则 0.1.7-rc.1 的启动 peer 装不进去。
- 14 项内置插件全部升级到当前 npm latest：Codex UI 1.1.17、IM Connect 0.1.54、Automation 0.1.50、Skills Manager 1.1.3、Archive Manager 1.0.4、Agency Agents 1.0.3、Codex Pet 0.1.9、BTW 0.1.12、Simplify 0.1.9、Code Review 0.1.5、PUA 0.3.17、Better Sidebar 0.21.1、MCP Connector 0.2.58、dshmarket 1.64.0。
- 离线仓库不再打包 Context 和 Usage Billing。这两项在 1.0.66 已移出安装清单。

## 1.0.66 — 2026-09-21

- 内置社区插件改为克制清单：去掉 Context、Usage Billing。新安装不再随包这两项。离线仓库仍保留它们，避免旧 Profile 升级时锁文件解析失败。
- 5 项内置插件升级到当前 npm latest：Skills Manager 1.0.1、Archive Manager 1.0.2、Agency Agents 1.0.1、MCP Connector 0.2.54、dshmarket 1.53.0。其余 9 项已是 latest。官方 DSH 仍为 0.1.6-alpha.2。

## 1.0.65 — 2026-09-19

- 启动清理只摘掉串进 Web profile 依赖的残留官方包，不再用桌面白名单维护官方可选层。官方以后加插件不必再改 Desktop。
- 2 项内置插件升级到当前 npm latest：Codex UI 1.1.14、dshmarket 1.48.0。其余 14 项内置插件和官方 DSH 0.1.6-alpha.2 已是 latest。

## 1.0.64 — 2026-09-18

- 内置官方 DSH 运行时由 0.1.6-alpha.1 升级至 0.1.6-alpha.2，并同步 scope、timeout、invariants 启动 peer。
- 13 项内置插件升级到当前 npm latest：Codex UI 1.1.13、IM Connect 0.1.51、Automation 0.1.45、Skills Manager 0.1.53、Archive Manager 0.1.44、Agency Agents 0.1.44、Codex Pet 0.1.7、BTW 0.1.10、Simplify 0.1.7、Code Review 0.1.4、PUA 0.3.16、Context 0.53.3、MCP Connector 0.2.51。Better Sidebar、Usage Billing、dshmarket 已是 latest。

