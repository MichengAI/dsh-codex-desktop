/** dshmarket exposes this local status route while it serializes plugin work. */
export const DSH_MARKET_STATUS_PATH = '/dsh-market/status'

/** Ignore unrelated or unavailable endpoints: only an explicit busy state pauses a restart. */
export function isDshMarketOperationBusy(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { busy?: unknown }).busy === true
}
