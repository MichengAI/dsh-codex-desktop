export type DesktopColorScheme = 'light' | 'dark'
export type DesktopThemePreference = DesktopColorScheme | 'system'

export interface DesktopThemeSnapshot {
  readonly colorScheme: DesktopColorScheme
  readonly preference?: DesktopThemePreference
}

export interface DesktopThemePalette {
  readonly aboutBackground: string
  readonly settingsBackground: string
  readonly shellBackground: string
  readonly shortcutsBackground: string
  readonly titleBarBackground: string
  readonly titleBarSymbol: string
}

export const DESKTOP_THEME_PALETTES: Readonly<Record<DesktopColorScheme, DesktopThemePalette>> = {
  light: {
    aboutBackground: '#ffffff',
    settingsBackground: '#ffffff',
    shellBackground: '#ffffff',
    shortcutsBackground: '#ffffff',
    // Match Codex's restrained mint-to-cyan title-bar wash. Electron's native
    // caption-button area accepts only a solid color, so use the gradient's
    // right-side resting color there and paint the full gradient in shell.html.
    titleBarBackground: '#f1f4f3',
    titleBarSymbol: '#0f1115',
  },
  dark: {
    aboutBackground: '#202322',
    settingsBackground: '#202322',
    shellBackground: '#171918',
    shortcutsBackground: '#262827',
    // Match Codex's dark charcoal-to-teal title-bar wash. Electron's native
    // caption-button area is solid, so it uses the gradient's right endpoint.
    titleBarBackground: '#1f2020',
    titleBarSymbol: '#d7d9d8',
  },
}

export function normalizeDesktopColorScheme(value: unknown): DesktopColorScheme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined
}

export function normalizeDesktopThemeSnapshot(value: unknown): DesktopThemeSnapshot | undefined {
  const legacyColorScheme = normalizeDesktopColorScheme(value)
  if (legacyColorScheme !== undefined) return { colorScheme: legacyColorScheme }
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as { colorScheme?: unknown; preference?: unknown }
  const colorScheme = normalizeDesktopColorScheme(candidate.colorScheme)
  if (colorScheme === undefined) return undefined
  const preference = candidate.preference === 'light' || candidate.preference === 'dark' || candidate.preference === 'system'
    ? candidate.preference
    : undefined
  return preference === undefined ? { colorScheme } : { colorScheme, preference }
}
