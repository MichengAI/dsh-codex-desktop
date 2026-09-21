# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.66 — 2026-09-21

- 内置社区插件改为克制清单：去掉 Context、Usage Billing。新安装不再随包这两项。离线仓库仍保留它们，避免旧 Profile 升级时锁文件解析失败。
- 5 项内置插件升级到当前 npm latest：Skills Manager 1.0.1、Archive Manager 1.0.2、Agency Agents 1.0.1、MCP Connector 0.2.54、dshmarket 1.53.0。其余 9 项已是 latest。官方 DSH 仍为 0.1.6-alpha.2。

## 1.0.65 — 2026-09-19

- 启动清理只摘掉串进 Web profile 依赖的残留官方包，不再用桌面白名单维护官方可选层。官方以后加插件不必再改 Desktop。
- 2 项内置插件升级到当前 npm latest：Codex UI 1.1.14、dshmarket 1.48.0。其余 14 项内置插件和官方 DSH 0.1.6-alpha.2 已是 latest。

## 1.0.64 — 2026-09-18

- 内置官方 DSH 运行时由 0.1.6-alpha.1 升级至 0.1.6-alpha.2，并同步 scope、timeout、invariants 启动 peer。
- 13 项内置插件升级到当前 npm latest：Codex UI 1.1.13、IM Connect 0.1.51、Automation 0.1.45、Skills Manager 0.1.53、Archive Manager 0.1.44、Agency Agents 0.1.44、Codex Pet 0.1.7、BTW 0.1.10、Simplify 0.1.7、Code Review 0.1.4、PUA 0.3.16、Context 0.53.3、MCP Connector 0.2.51。Better Sidebar、Usage Billing、dshmarket 已是 latest。

## 1.0.63 — 2026-09-16

- 内置官方 DSH 运行时由 0.1.5-rc.2 升级至 0.1.6-alpha.1，并同步 scope、timeout、invariants 启动 peer。
- 15 项内置插件升级到当前 npm latest：Codex UI 1.1.11、IM Connect 0.1.50、Automation 0.1.44、Skills Manager 0.1.52、Archive Manager 0.1.43、Agency Agents 0.1.43、Codex Pet 0.1.6、BTW 0.1.8、Simplify 0.1.5、Code Review 0.1.2、PUA 0.3.13、Context 0.53.0、MCP Connector 0.2.49、Usage Billing 1.4.0、dshmarket 1.47.0。Better Sidebar 已是 latest。

## 1.0.62 — 2026-09-15

- 修复内网首次启动时，共享 Web 配置里已有 `node_modules` 但没有记录 pnpm 仓库、桌面改去访问 npm 注册表导致专家/插件/技能装不上的问题。现在会改用随包离线仓库补种。
- 冷启动等待加长：进程就绪由 45 秒改为 120 秒，页面完成插件加载由 30 秒改为 90 秒。慢启动不再用失败窗盖掉工作台；若再等约 90 秒仍是白页，会显示带日志路径的失败提示。期间若页面恢复健康，会自动回到工作台。帮助菜单在已有配置时提供「打开恢复页」。
- `pack` / `dist` 会先清掉残留运行时目录和额外的 `release-*` 目录，避免沿用旧的随包插件仓库。
- 日常启动跳过空的 pending、desktop-bridge 和 bundle 对账扫描。
- 启动不再自动补齐「清单有、磁盘没有」的社区插件；改由客户端 pending 清单驱动。随包插件仍会按原逻辑补种。

