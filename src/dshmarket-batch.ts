/** dshmarket exposes this local status route while it serializes plugin work. */
export const DSH_MARKET_STATUS_PATH = '/dsh-market/status'

/** Ignore unrelated or unavailable endpoints: only an explicit busy state pauses a restart. */
export function isDshMarketOperationBusy(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { busy?: unknown }).busy === true
}

/**
 * A bulk update is a sequence of individual requests. The market releases
 * `busy` after replying to each item, and the browser schedules the next item
 * immediately afterwards. Require one quiet interval as well as an idle read
 * so Electron cannot observe that tiny handoff gap as the end of the batch.
 */
export async function waitForDshMarketBatchToSettle(
  status: () => Promise<unknown>,
  pause: () => Promise<void>,
): Promise<void> {
  for (;;) {
    while (isDshMarketOperationBusy(await status())) await pause()
    await pause()
    if (!isDshMarketOperationBusy(await status())) return
  }
}
