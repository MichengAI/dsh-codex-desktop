# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 未发布

## 1.0.50 — 2026-09-08

- 内置插件更新到 Codex UI 0.2.112、IM Connect 0.1.38、Automation 0.1.34、Skills Manager 0.1.43、Archive Manager 0.1.32、Agency Agents 0.1.34、BTW 0.1.4、`dsh-context` 0.46.0、MCP Connector 0.2.39、Usage Billing 1.0.42 和 `dshmarket` 1.45.0；DSH Better Sidebar 与 Simplify 维持当前最新版本。
- 任务栏未读数量不再计入子代理会话，同时覆盖 Codex UI 未读记录和备用完成统计；已有未读记录及后续补齐子代理标识的会话也会正确过滤。

发布标签：[`v1.0.50`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.50)。

## 1.0.49 — 2026-09-07

- 启动时在插件补装前清理旧 bridge 的依赖声明和包文件，兼容此前只迁移配置留下的残留。文件清理失败时记录警告并在下次启动重试，不因此阻断启动；私有目录动态注入的 bridge 继续可用。
- 修复旧 profile 仅在加载列表登记内置插件时，跳过补装并移除加载项的问题；补装以 `dependencies` 中的安装声明为准。
- 兼容 pnpm 11 在 `.modules.yaml` 中写入的 JSON 状态，离线安装回退到在线安装时仍沿用原仓库，避免 `ERR_PNPM_UNEXPECTED_STORE`。
- 修正离线冒烟测试的 pnpm 11 环境开关，并同时校验插件文件、依赖登记和加载列表。

发布标签：[`v1.0.49`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.49)。

## 1.0.48 — 2026-09-07

- Desktop 启动 DSH 时从应用私有目录动态注入桌面桥接。独立 `dsh web` 使用 Web 插件管理通道，旧版桥接配置会从共享 profile 中迁移并备份。
- 暴露桥接服务前校验 Desktop 环境与 pnpm 可用性，避免只读 pnpm 查询修改 profile。
- Windows 任务栏角标同步读取 Codex UI 的未读记录，打开任务后的已读状态与任务列表保持一致。
- 更新提示遵循更新库的可用性判断，避免把线上旧版或暂不可用的版本提示为新版本并触发下载。
- 离线资源同时包含 pnpm 包版本元数据，确保全新用户缓存下也能完成首次安装；保留首次离线安装错误及超时输出，便于诊断。
- 新增内置 Usage Billing 1.0.31、BTW 0.1.3 和 Simplify 0.1.2，内置插件清单扩充为 13 项。
- 将 Codex UI 升级到 0.2.106、Automation 升级到 0.1.32、`dsh-context` 升级到 0.44.0、MCP Connector 升级到 0.2.37，其余内置插件版本保持不变。

发布标签：[`v1.0.48`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.48)。

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
