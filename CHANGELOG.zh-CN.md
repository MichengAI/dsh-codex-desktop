# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.47 — 2026-09-06

- 将插件安装错误与 DSH 启动分开处理：安装失败后仍尝试加载工作台，不直接阻断启动。
- 恢复模式仅定位与加载失败相关的插件，支持回溯损坏依赖的所属插件；无关插件继续启用，确认隔离前先展示候选列表。
- 修复非关键插件失败时强制将可用工作台切到恢复页的问题。异常仍记录日志，试恢复插件通过完整健康检查后才清理恢复备份。
- 保留客户端加载超过 30 秒且近期插件变更提供候选线索时进入恢复的规则。
- 内置插件更新到 Codex UI 0.2.103、Automation 0.1.31、Skills Manager 0.1.40、Archive Manager 0.1.30、Agency Agents 0.1.32、`dsh-context` 0.43.0、MCP Connector 0.2.35 和 `dshmarket` 1.44.0。IM Connect 保持 0.1.34，DSH Better Sidebar 保持 0.18.0。

发布标签：[`v1.0.47`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.47)。

## 1.0.46 — 2026-09-04

- 修复 Windows 任务栏未读完成角标：打开已完成任务后会稳定清除未读状态，后续任务列表刷新不再把历史完成任务重复计入。

发布标签：[`v1.0.46`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.46)。

## 1.0.45 — 2026-09-04

- 新增插件恢复模式：启动失败后隔离第三方插件，并提供独立恢复页，支持恢复、卸载或回到最近正常配置。
- 没有仍需隔离的插件时自动退出恢复模式；恢复会话中的健康启动不再覆盖最近一次已验证的配置检查点。
- 修复 Windows 关闭关于、设置或快捷键窗口时主窗口闪一下的问题。
- 将内置插件更新到 Codex UI 0.2.102、IM Connect 0.1.34、Automation 0.1.27、Skills Manager 0.1.38、Archive Manager 0.1.29、Agency Agents 0.1.30、`dsh-context` 0.41.2、DSH Better Sidebar 0.18.0 和 `dshmarket` 1.41.0。
- 稳住运行时解压超时测试：先挂上拒绝断言，再等孙进程 PID，避免 macOS Intel CI 在 200ms 内输掉竞态。本版取代未发布的 `v1.0.44` 标签。

发布标签：[`v1.0.45`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.45)。

## 1.0.43 — 2026-09-01

- 将内置官方 DSH 运行时及其启动依赖升级到 `0.1.2-alpha.3`。
- 将内置生态组件更新到 Codex UI 0.2.97、IM Connect 0.1.30、Archive Manager 0.1.22 和 MCP Connector 0.2.32。
- 强化离线运行时初始化：Windows 冒烟复用共享插件校验器，鉴权与未鉴权路径都等待桌面就绪标记，并在取消或超时解压时清理完整进程树。

发布标签：[`v1.0.43`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.43)。

## 1.0.41 — 2026-08-31

- 修复离线包缺少官方 DSH 启动所需 peer 依赖的问题，确保随包运行时无需联网即可完整启动。
- 将便携版首次运行时的校验、解压和大量文件复制移入独立子进程，并展示分阶段进度，避免初始化期间窗口长时间未响应。
- 将运行时与插件仓库的解压完成标记绑定到随包归档 SHA256；覆盖升级或复用旧便携目录时，空标记和陈旧标记会自动触发重新解压，离线首启不再缺少插件。
- 将 Windows、macOS 与 Linux 打包冒烟测试统一为强制离线，并在隔离 Profile 中核对全部十个随包插件及其固定版本。

发布标签：[`v1.0.41`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.41)。
