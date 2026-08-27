/** dshmarket exposes this local status route while it serializes plugin work. */
export const DSH_MARKET_STATUS_PATH = '/dsh-market/status'

/** Ignore unrelated or unavailable endpoints: only an explicit busy state pauses a restart. */
export function isDshMarketOperationBusy(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { busy?: unknown }).busy === true
}

export interface DshMarketBatchWaitOptions {
  readonly maxWaitMs: number
  readonly pollIntervalMs: number
}

/**
 * Wait for one quiet interval after dshmarket becomes idle. A deadline prevents
 * a stuck market status endpoint from blocking the desktop restart forever.
 * Returns false when that deadline expires.
 */
export async function waitForDshMarketBatchToSettle(
  status: () => Promise<unknown>,
  pause: () => Promise<void>,
  options: DshMarketBatchWaitOptions,
): Promise<boolean> {
  let waitedMs = 0
  const pauseWithinDeadline = async (): Promise<boolean> => {
    if (waitedMs >= options.maxWaitMs) return false
    await pause()
    waitedMs += options.pollIntervalMs
    return true
  }
  for (;;) {
    while (isDshMarketOperationBusy(await status())) {
      if (!await pauseWithinDeadline()) return false
    }
    if (!await pauseWithinDeadline()) return false
    if (!isDshMarketOperationBusy(await status())) return true
  }
}
