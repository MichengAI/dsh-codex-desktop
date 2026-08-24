export interface WindowNavigationTarget {
  readonly webContents: {
    stop(): void
  }
}

/**
 * Serializes the result handling of BrowserWindow navigations.
 *
 * Electron rejects an older loadFile/loadURL promise with ERR_ABORTED when a
 * newer navigation supersedes it. That rejection is expected and must not be
 * promoted to a startup failure.
 */
export class WindowNavigationCoordinator {
  private revision = 0
  private activeRevision: number | undefined

  isNavigating(): boolean {
    return this.activeRevision !== undefined
  }

  async navigate(
    target: WindowNavigationTarget,
    load: () => Promise<void>,
    afterLoad?: () => Promise<void>,
  ): Promise<boolean> {
    const revision = ++this.revision
    this.activeRevision = revision
    target.webContents.stop()
    try {
      await load()
      if (revision !== this.revision) return false
      await afterLoad?.()
      return revision === this.revision
    } catch (error) {
      if (revision !== this.revision) return false
      throw error
    } finally {
      if (this.activeRevision === revision) this.activeRevision = undefined
    }
  }
}
