# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.81 — 2026-10-07

**适配与升级**

- 内置插件升级到当前最新版：Codex UI 1.1.30、IM Connect 0.1.66、Automation 0.1.58、Skills Manager 1.1.13、Archive Manager 1.0.15、Agency Agents 1.0.11、Codex Pet 0.1.15、BTW 0.1.17、Code Review 0.1.12、PUA 0.3.24。Simplify 0.1.14、Better Sidebar 0.24.1、dshmarket 1.66.9 和官方 DSH 0.2.0-rc.2 已是当前最新版，本次不变。安装包会按这些精确版本装配离线插件。
- 若从 1.0.77 之前的版本升级：新安装仍不附带 Context 和费用插件；桌面宠物空闲时会跟着光标转头；从更早版本升级时，离线也能装上配套插件，并保留原有插件配置；Windows 安装包首次启动不再缺少配套插件依赖；原先无法启动的平台安装包可以正常启动。

## 1.0.80 — 2026-10-06

**适配与升级**

- DSH 页面现在提供官方 `dshDesktop` 标记，桌面端侧栏左下角会显示官方账号登录。登录仍走官方账号服务，本壳不保存凭证。
- 登录进入等待浏览器时，用系统浏览器打开官方授权页。同一次尝试不会重复打开；尝试结束、浏览器打不开，或过了十分钟后，可以再开。
- 登录完成页打开 `dsh://open` 时回到本桌面，不再交给已安装的官方桌面。
- 桌面窗口里的菜单底色改为实底，避免侧栏文字透出账号菜单。
- 内置插件升级到当前最新版：Codex UI 1.1.29、IM Connect 0.1.64、Automation 0.1.54、Skills Manager 1.1.10、Archive Manager 1.0.13、Agency Agents 1.0.9、Codex Pet 0.1.13、BTW 0.1.16、Simplify 0.1.14、Code Review 0.1.11、PUA 0.3.23、dshmarket 1.66.9。Better Sidebar 0.24.1 和官方 DSH 0.2.0-rc.2 已是当前最新版，本次不变。安装包会按这些精确版本装配离线插件。

## 1.0.79 — 2026-10-01

**修复**

- 开启局域网访问后，桌面端不再在两分钟后误报启动超时。本机窗口仍只打开 127.0.0.1。

**适配与升级**

- 内置插件升级到当前最新版：IM Connect 0.1.60、Skills Manager 1.1.8、Archive Manager 1.0.10、Simplify 0.1.13、Code Review 0.1.10、PUA 0.3.22、dshmarket 1.66.7。Codex UI 1.1.25、Automation 0.1.53、Agency Agents 1.0.7、Codex Pet 0.1.12、BTW 0.1.15、Better Sidebar 0.24.1 已是当前最新版，本次不变。

## 1.0.78 — 2026-09-30

**适配与升级**

- 内置 DSH 运行时由 0.2.0-rc.1 升级到 0.2.0-rc.2，并同步 scope、timeout、invariants 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.25、IM Connect 0.1.58、Automation 0.1.53、Skills Manager 1.1.7、Archive Manager 1.0.9、Agency Agents 1.0.7、Codex Pet 0.1.12、BTW 0.1.15、Simplify 0.1.12、Code Review 0.1.9、PUA 0.3.21、dshmarket 1.66.6。Better Sidebar 0.24.1 已是当前最新版，本次不变。

## 1.0.77 — 2026-09-29

**适配与升级**

- 内置 DSH 运行时由 0.1.7-rc.2 升级到 0.2.0-rc.1，并同步 scope、timeout、invariants 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.22、IM Connect 0.1.57、Automation 0.1.52、Skills Manager 1.1.5、Archive Manager 1.0.7、Agency Agents 1.0.6、Codex Pet 0.1.11、BTW 0.1.14、Simplify 0.1.11、Code Review 0.1.8、PUA 0.3.19、Better Sidebar 0.24.1、dshmarket 1.66.5。
- 新安装不再附带 MCP 连接器；已经安装的仍会保留。
- 官方定时任务改为可选插件，默认关闭；需要时在插件管理的官方分组中打开。已保存的任务仍会保留。

**更新**

- Windows 压缩包发现新版本时，不再下载或运行安装包。它会打开对应的 zip；请退出后替换当前文件夹。不要运行安装包，否则会在另一个位置再装一份。



