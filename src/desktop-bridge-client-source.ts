interface DesktopNavigationState {
  canBack: boolean
  canForward: boolean
  canNextChat: boolean
  canPreviousChat: boolean
}

interface SessionList {
  ids: string[]
  byId: Record<string, {
    completed?: boolean
    displayTitle: string
    pendingInteraction?: 'approval' | 'plan-review' | 'question'
    running: boolean
  }>
  current?: string
}

interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
  loader: {
    await(): Promise<void>
    entries(): Iterable<{ options: { name: string }, fiber?: { state: number } }>
  }
  layout: { toggleSidebar(): void }
  locale: {
    getSnapshot(): { active: string }
    subscribe(listener: () => void): () => void
  }
  sessions: {
    binding(id: string): {
      session: {
        getSnapshot(): {
          nodes: Array<{
            kind: string
            blocks?: Array<{ kind: string; text?: string }>
          }>
        }
      }
    } | undefined
    list: { getSnapshot(): SessionList; subscribe(listener: () => void): () => void }
    open(id: string): void
    scope(id: string): {
      get(name: 'conversation'): { send(text: string): Promise<void> } | undefined
    } | undefined
  }
  workspaces: {
    create(input: { path: string }): Promise<{ id?: string; workspaceId?: string } | string>
    pickDirectory(): Promise<string | null>
    startSession(workspaceId?: string): void
  }
}

interface DesktopShellBridge {
  onAction(listener: (id: string) => void): () => void
  onOpenSession(listener: (id: string) => void): () => void
  onNotificationReply(listener: (value: { sessionId: string; text: string }) => void): () => void
  reportNotification(event: {
    type: 'notify' | 'dismiss' | 'badge' | 'reply-error'
    count?: number
    body?: string
    kind?: 'turn-complete' | 'approval' | 'question'
    sessionId?: string
    title?: string
  }): void
  reportLocale(locale: string): void
  reportBoot(report: { status: 'healthy' } | { status: 'failed', plugins: string[], error?: string, workbenchReady: boolean }): void
  reportTheme(value: { colorScheme: 'light' | 'dark'; preference: 'light' | 'dark' | 'system' }): void
  reportState(state: DesktopNavigationState): void
}

export function desktopBridgeClientFactory(): { apply(ctx: ClientContext): void; inject: string[] } {
    const inject = ['sessions', 'workspaces', 'layout', 'locale']

    const visibleSessionRows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.dcu-wb-session[role="treeitem"][aria-selected]')]
      .filter(element => element.offsetParent !== null)

    const selectedSessionRow = (): HTMLElement | undefined => visibleSessionRows()
      .find(element => element.getAttribute('aria-selected') === 'true')

    const clickByLabel = (patterns: RegExp[]): void => {
      const candidates = [...document.querySelectorAll<HTMLElement>('button,[role="button"],[role="menuitem"]')]
        .filter(element => element.offsetParent !== null)
      candidates.find(element => {
        const labels = [element.getAttribute('aria-label'), element.textContent]
          .filter((label): label is string => typeof label === 'string')
          .map(label => label.trim())
          .filter(label => label !== '')
        return patterns.some(pattern => labels.some(label => pattern.test(label)))
      })?.click()
    }

    const apply = (ctx: ClientContext): void => {
      const bridge = (window as Window & { dshDesktopShell?: DesktopShellBridge }).dshDesktopShell
      if (bridge === undefined) return
      let history: string[] = []
      let historyIndex = -1
      let notificationBaseline: Map<string, { pendingInteraction?: string; running: boolean }> | undefined
      let selectedForDismiss: string | undefined
      const unreadCompletions = new Set<string>()
      let reportedBadgeCount: number | undefined

      const notificationKindForInteraction = (value: string | undefined): 'approval' | 'question' | undefined => {
        if (value === undefined) return undefined
        return value === 'question' ? 'question' : 'approval'
      }

      const snapshot = (): SessionList => ctx.sessions.list.getSnapshot()
      const reportBoot = async (): Promise<void> => {
        let error: string | undefined
        try {
          await ctx.loader.await()
        } catch (cause) {
          error = typeof cause === 'object' && cause !== null && typeof (cause as { message?: unknown }).message === 'string'
            ? (cause as { message: string }).message
            : String(cause)
        }
        const plugins = [...ctx.loader.entries()]
          .filter(entry => entry.fiber?.state !== 2)
          .map(entry => entry.options.name)
          .filter(name => typeof name === 'string' && name.length > 0)
          .slice(0, 100)
        if (error === undefined && plugins.length === 0) {
          bridge.reportBoot({ status: 'healthy' })
          return
        }
        // Loader 完成不等于 React 已提交布局，等绘制后再检查实际会话界面。
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        const frame = document.querySelector('[data-shell-overlay]')?.parentElement
        const editor = frame?.querySelector<HTMLElement>('[role="textbox"]')
        const bounds = editor?.getBoundingClientRect()
        const workbenchReady = editor !== undefined && editor !== null
          && bounds !== undefined && bounds.width > 0 && bounds.height > 0
          && getComputedStyle(editor).visibility === 'visible'
        bridge.reportBoot({ status: 'failed', plugins, workbenchReady,
          ...(error === undefined ? {} : { error: error.slice(0, 4000) }) })
      }
      const reportBadge = (): void => {
        if (reportedBadgeCount === unreadCompletions.size) return
        reportedBadgeCount = unreadCompletions.size
        bridge.reportNotification({ type: 'badge', count: unreadCompletions.size })
      }
      const markSessionRead = (id: string): void => {
        if (!unreadCompletions.delete(id)) return
        reportBadge()
      }
      const latestAssistantPreview = (id: string): string | undefined => {
        const nodes = ctx.sessions.binding(id)?.session.getSnapshot().nodes
        if (!Array.isArray(nodes)) return undefined
        for (let index = nodes.length - 1; index >= 0; index -= 1) {
          const node = nodes[index]
          if (node?.kind !== 'assistant' || !Array.isArray(node.blocks)) continue
          const text = node.blocks
            .filter(block => block?.kind === 'text' && typeof block.text === 'string')
            .map(block => block.text?.trim() ?? '')
            .filter(Boolean)
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim()
          if (text !== '') return text.slice(0, 500)
        }
        return undefined
      }
      const report = (): void => {
        const rows = visibleSessionRows()
        const currentRow = selectedSessionRow()
        const currentIndex = currentRow === undefined ? -1 : rows.indexOf(currentRow)
        bridge.reportState({
          canBack: historyIndex > 0,
          canForward: historyIndex >= 0 && historyIndex < history.length - 1,
          canPreviousChat: currentIndex > 0,
          canNextChat: currentIndex >= 0 && currentIndex < rows.length - 1,
        })
      }
      const trackCurrent = (): void => {
        const nextSnapshot = snapshot()
        const current = nextSnapshot.current
        const isInitialSnapshot = notificationBaseline === undefined
        if (current !== undefined && history[historyIndex] !== current) {
          history = history.slice(0, historyIndex + 1)
          history.push(current)
          historyIndex = history.length - 1
        }
        if (current !== selectedForDismiss) {
          selectedForDismiss = current
          if (current !== undefined) {
            bridge.reportNotification({ type: 'dismiss', sessionId: current })
            if (document.hasFocus()) markSessionRead(current)
          }
        }
        const nextBaseline = new Map<string, { pendingInteraction?: string; running: boolean }>()
        for (const id of [...unreadCompletions]) {
          if (nextSnapshot.byId[id] === undefined) unreadCompletions.delete(id)
        }
        for (const id of nextSnapshot.ids) {
          const row = nextSnapshot.byId[id]
          if (row === undefined) continue
          if (isInitialSnapshot && row.completed === true) unreadCompletions.add(id)
          const previous = notificationBaseline?.get(id)
          nextBaseline.set(id, { running: row.running, ...(row.pendingInteraction === undefined ? {} : { pendingInteraction: row.pendingInteraction }) })
          if (previous === undefined) continue
          if (previous.running && !row.running && row.pendingInteraction === undefined) {
            unreadCompletions.add(id)
            bridge.reportNotification({
              type: 'notify',
              kind: 'turn-complete',
              sessionId: id,
              title: row.displayTitle,
              body: latestAssistantPreview(id),
            })
          }
          const interactionKind = notificationKindForInteraction(row.pendingInteraction)
          if (interactionKind !== undefined && interactionKind !== notificationKindForInteraction(previous.pendingInteraction)) {
            bridge.reportNotification({
              type: 'notify',
              kind: interactionKind,
              sessionId: id,
              title: row.displayTitle,
            })
          }
        }
        if (current !== undefined && document.hasFocus()) unreadCompletions.delete(current)
        notificationBaseline = nextBaseline
        reportBadge()
        queueMicrotask(report)
      }
      const openHistory = (offset: number): void => {
        const next = historyIndex + offset
        const id = history[next]
        if (id === undefined) return
        historyIndex = next
        ctx.sessions.open(id)
        queueMicrotask(report)
      }
      const openAdjacent = (offset: number): void => {
        const rows = visibleSessionRows()
        const current = selectedSessionRow()
        const index = current === undefined ? -1 : rows.indexOf(current)
        rows[index + offset]?.click()
        setTimeout(report, 80)
      }
      const openFolder = async (): Promise<void> => {
        const path = await ctx.workspaces.pickDirectory()
        if (path === null) return
        const created = await ctx.workspaces.create({ path })
        const workspaceId = typeof created === 'string'
          ? created
          : typeof created === 'object' && created !== null
            ? created.id ?? created.workspaceId
            : undefined
        if (typeof workspaceId !== 'string' || workspaceId.trim() === '') {
          throw new Error('创建工作区后未返回有效的 workspaceId。')
        }
        ctx.workspaces.startSession(workspaceId)
      }
      const sendNotificationReply = async (value: { sessionId: string; text: string }): Promise<void> => {
        const text = value.text.trim()
        if (text === '') return
        const conversation = ctx.sessions.scope(value.sessionId)?.get('conversation')
        if (conversation === undefined) throw new Error(`会话 ${value.sessionId} 不提供 conversation 服务。`)
        await conversation.send(text)
        markSessionRead(value.sessionId)
        bridge.reportNotification({ type: 'dismiss', sessionId: value.sessionId })
      }
      const onAction = (id: string): void => {
        // Omitting the id inherits the selected Session's Workspace, exactly like
        // the DSH “新建任务” control.
        if (id === 'new-chat') ctx.workspaces.startSession()
        else if (id === 'open-folder') void openFolder().catch(error => { console.error('打开文件夹失败。', error) })
        else if (id === 'toggle-sidebar') ctx.layout.toggleSidebar()
        else if (id === 'previous-chat') openAdjacent(-1)
        else if (id === 'next-chat') openAdjacent(1)
        else if (id === 'back') openHistory(-1)
        else if (id === 'forward') openHistory(1)
        else if (id === 'find') clickByLabel([/^(?:搜索会话|查找|search sessions|find)$/i])
        else if (id === 'settings') clickByLabel([/^设置$|^settings$|preferences/i])
      }

      ctx.effect(() => {
        const stopAction = bridge.onAction(onAction)
        const stopOpenSession = bridge.onOpenSession(id => { markSessionRead(id); ctx.sessions.open(id) })
        const stopNotificationReply = bridge.onNotificationReply(value => {
          void sendNotificationReply(value).catch(error => {
            console.error('通知回复发送失败。', error)
            bridge.reportNotification({ type: 'reply-error', sessionId: value.sessionId })
          })
        })
        const stopList = ctx.sessions.list.subscribe(trackCurrent)
        const reportLocale = (): void => { bridge.reportLocale(ctx.locale.getSnapshot().active) }
        const stopLocale = ctx.locale.subscribe(reportLocale)
        const bootTimer = setTimeout(() => {
          void reportBoot().catch(error => { console.error('上报插件启动状态失败。', error) })
        }, 0)
        const onWindowFocus = (): void => {
          const current = snapshot().current
          if (current !== undefined) markSessionRead(current)
        }
        window.addEventListener('focus', onWindowFocus)
        const observer = new MutationObserver(report)
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'] })
        trackCurrent()
        reportLocale()
        return () => { clearTimeout(bootTimer); stopAction(); stopOpenSession(); stopNotificationReply(); stopList(); stopLocale(); window.removeEventListener('focus', onWindowFocus); observer.disconnect() }
      }, 'desktop-shell bridge')
    }

    return { apply, inject }
}

export function desktopBridgeClientBundle(): string {
  return `window.__ModuleLoader__.load({id:'dsh-desktop-bridge',factory:${desktopBridgeClientFactory.toString()}});\n`
}
