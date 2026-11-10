# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.95 — 2026-11-10

**多语言与国际化**

- 桌面端全界面支持 8 种语言：简体中文、英语、日语、西班牙语、法语、德语、俄语与葡萄牙语。
- 辅助窗口（桌面端设置、键盘快捷键、关于、启动等待进度、故障自愈恢复模式）、托盘菜单、桌面通知和操作按钮文案均自动跟随当前所选语言实时切换。
- 提供 8 种语言的完整产品使用与生态说明文档。

**内置插件升级**

- 全量内置插件升级到最新版本：Codex UI 2.0.21、IM Connect 1.0.34、Automation 1.0.22、Skills Manager 1.4.0、Archive Manager 1.3.1、Agency Agents 1.2.27、Codex Pet 1.0.14、BTW 1.3.7、Simplify 1.0.8、Code Review 1.0.9、PUA 1.0.10、Better Sidebar 0.30.1、dshmarket 1.73.17 与 Context 0.83.1。安装包按这些精确版本装配离线插件。
- 新安装继续随包 Context。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。

## 1.0.93 — 2026-11-05

**适配与升级**

- 内置 DSH 运行时升级到 0.2.2-rc.1，并同步升级 group（1.1.0）、scope（0.2.2-rc.1）与 timeout（0.2.2-rc.1）启动依赖。
- 全量内置插件升级到最新版本：Codex UI 2.0.19、IM Connect 1.0.27、Automation 1.0.18、Skills Manager 1.2.33、Archive Manager 1.2.8、Agency Agents 1.2.26、Codex Pet 1.0.13、BTW 1.3.3、Simplify 1.0.7、Code Review 1.0.8、PUA 1.0.8、Better Sidebar 0.30.1、dshmarket 1.73.11 与 Context 0.82.0。安装包按这些精确版本装配离线插件。
- 新安装继续随包 Context。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。

## 1.0.92 — 2026-10-29

**适配与升级**

- 这是 1.0.89 之后的首个发布。
- 内置 DSH 运行时由 0.2.1-rc.3 升级到 0.2.2-alpha.2，并同步 group、scope、timeout 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 2.0.4、IM Connect 1.0.20、Automation 1.0.13、Skills Manager 1.2.22、Archive Manager 1.1.18、Agency Agents 1.2.18、Codex Pet 1.0.7、BTW 1.3.0、Simplify 1.0.5、Code Review 1.0.5、PUA 1.0.5、Better Sidebar 0.28.2、dshmarket 1.73.3 与 Context 0.78.0。安装包会按这些精确版本装配离线插件。
- 打包冒烟检查鲁棒性：服务就绪后为前端渲染分配独立的就绪超时，避免在慢速虚拟化环境中因首启依赖补种耗时导致误报启动超时。
- 新安装继续随包 Context。费用插件和 MCP 连接器仍不附带，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。

## 1.0.89 — 2026-10-25

**适配与升级**

- 内置 DSH 运行时由 0.2.1-rc.2 升级到 0.2.1-rc.3，并同步 group、scope、timeout 与启动依赖。
- 内置插件升级到当前最新版：Codex UI 1.1.49、IM Connect 1.0.17、Automation 1.0.10、Skills Manager 1.2.18、Archive Manager 1.1.12、Agency Agents 1.2.13、Codex Pet 1.0.6、BTW 1.0.8、Simplify 1.0.4、Code Review 1.0.3 与 PUA 1.0.3。Better Sidebar 0.28.0、dshmarket 1.66.44 与 Context 0.73.3 本次保持一致。

## 1.0.88 — 2026-10-21

**修复**

- 插件热重载保护：在插件市场或插件设置中安装、更新、卸载插件时，桌面端会等待安装进程、锁文件以及后续 bundle 校准完全结束并保持静默后再热重载，避免在耗时较长的安装中途提前重启导致插件缺失或进入恢复页。
- 启动期依赖保护：启动与热重载时保留用户在 Web profile 中安装的独立官方插件 bundle 和依赖声明，不再在启动期误删相关依赖。

**适配与升级**

- 内置插件升级到当前最新版：Codex UI 1.1.45、IM Connect 1.0.10、Automation 1.0.5、Skills Manager 1.2.8、Archive Manager 1.1.6、Agency Agents 1.2.8、Codex Pet 1.0.2、dshmarket 1.66.44、Context 0.73.3。BTW 1.0.0、Simplify 1.0.1、Code Review 1.0.1、PUA 1.0.1、Better Sidebar 0.28.0 与官方 DSH 0.2.1-rc.2 已是最新版，本次保持一致。安装包会按这些精确版本装配离线插件。
- 新安装继续随包 Context。费用插件和 MCP 连接器仍不附带，已经安装的会保留。官方定时任务默认关闭，需要时再打开，已保存的任务会保留。桌面宠物空闲时会跟着光标转头。从更早版本升级时，离线也能装上配套插件，并保留原有插件配置。Windows 安装包首次启动不再缺少配套插件依赖。Windows 压缩包发现新版本时会打开对应的 zip，请退出后替换当前文件夹，不要运行安装包。




