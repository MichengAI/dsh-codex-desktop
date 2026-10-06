# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 未发布

**适配与升级**

- DSH 页面现在提供官方 `dshDesktop` 标记，桌面端侧栏左下角会显示官方账号登录。登录仍走官方账号服务，本壳不保存凭证。
- 登录进入等待浏览器时，用系统浏览器打开授权页，不再只停在「等待登录」。
- 登录完成页打开 `dsh://open` 时回到本桌面，不再交给已安装的官方桌面。
- 桌面窗口里的菜单底色改为实底，避免侧栏文字透出账号菜单。
- 内置插件升级到当前最新版：Codex UI 1.1.29、IM Connect 0.1.64、Automation 0.1.54、Skills Manager 1.1.10、Archive Manager 1.0.13、Agency Agents 1.0.9、Codex Pet 0.1.13、BTW 0.1.16、Simplify 0.1.14、Code Review 0.1.11、PUA 0.3.23、dshmarket 1.66.9。Better Sidebar 0.24.1 和官方 DSH 0.2.0-rc.2 已是当前最新版，本次不变。这里只更新了版本清单，离线插件仓库还没有重新生成。

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

## 1.0.76 — 2026-09-25

**适配与升级**

- 内置 DSH 运行时由 0.1.7-rc.1 升级到 0.1.7-rc.2，并同步 scope、timeout、invariants 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.18、IM Connect 0.1.55、Automation 0.1.51、Skills Manager 1.1.4、Archive Manager 1.0.5、Agency Agents 1.0.5、Codex Pet 0.1.10、BTW 0.1.13、Simplify 0.1.10、Code Review 0.1.7、PUA 0.3.18、dshmarket 1.65.1；Better Sidebar 0.21.1 和 MCP Connector 0.2.58 已是当前最新版，本次不变。

## 1.0.75 — 2026-09-24

这一版是 1.0.66 之后的首次发布，包含这段时间的全部变更。

**适配与升级**

- 内置 DSH 运行时由 0.1.6-alpha.2 升级到 0.1.7-rc.1，并同步 scope、timeout、invariants 与启动依赖。
- 14 项内置插件全部升级到当前最新版：Codex UI 1.1.17、IM Connect 0.1.54、Automation 0.1.50、Skills Manager 1.1.3、Archive Manager 1.0.4、Agency Agents 1.0.3、Codex Pet 0.1.9、BTW 0.1.12、Simplify 0.1.9、Code Review 0.1.5、PUA 0.3.17、Better Sidebar 0.21.1、MCP Connector 0.2.58、dshmarket 1.64.0。
- 新安装不再随包 Context 和 Usage Billing 两项插件。

**新功能**

- 桌面宠物 v2：空闲时会跟着光标转头。

**修复**

- 修复从旧版本升级时配套插件装不上的问题，离线环境下也能完成升级；升级后会保留你原有的插件配置。
- 修复 Windows 安装包首次启动补装配套插件时可能缺少依赖的问题。
- 修复部分平台的安装包无法正常启动的问题。



