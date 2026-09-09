# 更新日志

[English](CHANGELOG.md)

以下记录最近发布的五个版本。

## 1.0.51 — 2026-09-09

- 修复宠物隐藏配置保存失败时未释放页内显示接管的问题，并阻止关闭前的在途同步重新接管。主进程新增回答结构、题目与选项、单选/多选及命令类型校验，保留自由文本回答。

- 内置 `@michengai/dsh-codex-pet` 0.1.2，纳入离线资源、首次启动补种及已有配置的缺失插件补装。

- Desktop 主动消费宠物插件的 `window.dshPet` v1 公开接口，自行负责原生渲染、窗口生命周期与 IPC，不再加载已移除的插件桌面页面。支持多会话操作，原生窗口失败或关闭时恢复页内显示；新增独立 Electron 冒烟，无需相邻宠物仓库。
- 升级 11 项内置插件至 npm latest：Codex UI 1.1.1、IM Connect 0.1.39、Automation 0.1.35、Skills Manager 0.1.44、Archive Manager 0.1.34、Agency Agents 0.1.36、dsh-context 0.47.0、Better Sidebar 0.18.1、MCP Connector 0.2.40、Usage Billing 1.0.43、dshmarket 1.45.1。其余 2 项已是最新版。
- 内置社区插件 `@linxin666/dsh-client-ui-git-graph` 0.3.18，纳入离线资源与首次启动补种清单。
- Windows 11 22H2 及以上启用原生 Mica 窗口背景，旧系统保留实色背景，并适配深浅主题。
- 启动前清理专用桌面会话中的旧 DSH 认证 Cookie，修复多次启动后可能出现的 HTTP 431 加载失败。
- 中英文 README 更新为 14 张压缩 WebP 实拍截图，覆盖首页、会话、自研设置和社区插件页面。

发布标签：[`v1.0.51`](https://github.com/MichengAI/dsh-codex-desktop/tree/v1.0.51)。

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
