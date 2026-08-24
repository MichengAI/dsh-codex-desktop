interface DesktopNavigationState {
  canBack: boolean
  canForward: boolean
  canNextChat: boolean
  canPreviousChat: boolean
}

interface SessionList {
  ids: string[]
  current?: string
}

interface ClientContext {
  effect(callback: () => void | (() => void), label?: string): void
  layout: { toggleSidebar(): void }
  sessions: {
    list: { getSnapshot(): SessionList; subscribe(listener: () => void): () => void }
    open(id: string): void
  }
  workspaces: {
    create(input: { path: string }): Promise<{ id?: string; workspaceId?: string } | string>
    pickDirectory(): Promise<string | null>
    startSession(workspaceId?: string): void
  }
}

interface DesktopShellBridge {
  onAction(listener: (id: string) => void): () => void
  reportState(state: DesktopNavigationState): void
}

export function desktopBridgeClientFactory(): { apply(ctx: ClientContext): void; inject: string[] } {
    const inject = ['sessions', 'workspaces', 'layout']

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

      const snapshot = (): SessionList => ctx.sessions.list.getSnapshot()
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
        const current = snapshot().current
        if (current !== undefined && history[historyIndex] !== current) {
          history = history.slice(0, historyIndex + 1)
          history.push(current)
          historyIndex = history.length - 1
        }
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
        const stopList = ctx.sessions.list.subscribe(trackCurrent)
        const observer = new MutationObserver(report)
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'] })
        trackCurrent()
        return () => { stopAction(); stopList(); observer.disconnect() }
      }, 'desktop-shell bridge')
    }

    return { apply, inject }
}

export function desktopBridgeClientBundle(): string {
  return `window.__ModuleLoader__.load({id:'dsh-desktop-bridge',factory:${desktopBridgeClientFactory.toString()}});\n`
}
