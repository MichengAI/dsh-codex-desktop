import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface IconResolutionOptions {
  appPath: string
  isPackaged: boolean
  resourcesPath: string
}

export function resolveIconCandidates(options: IconResolutionOptions): string[] {
  return options.isPackaged
    ? [
        join(options.resourcesPath, 'icon.ico'),
        join(options.resourcesPath, 'icon.png'),
      ]
    : [
        resolve(options.appPath, 'assets', 'icons', 'icon.ico'),
        resolve(options.appPath, 'assets', 'icon.png'),
      ]
}

/** 打包后从 extraResources 取图标；开发态使用仓库 assets。窗口必须传文件路径，避免 ICO 被压成 16px。 */
export function resolveAppIconPath(options: IconResolutionOptions): string | undefined {
  return resolveIconCandidates(options).find(candidate => existsSync(candidate))
}

/** 托盘缩放优先用 PNG，避免只拿到 ICO 里最小的那一档。 */
export function resolveRasterIconPath(options: IconResolutionOptions): string | undefined {
  const candidates = options.isPackaged
    ? [
        join(options.resourcesPath, 'icon.png'),
        join(options.resourcesPath, 'icon.ico'),
      ]
    : [
        resolve(options.appPath, 'assets', 'icon.png'),
        resolve(options.appPath, 'assets', 'icons', 'icon.ico'),
      ]
  return candidates.find(candidate => existsSync(candidate))
}

export const TRAY_ICON_SIZE = 32

/**
 * 应用图标四周留白适合大图展示，但缩进 Windows 托盘或任务栏后会显得偏小。
 * 小尺寸渲染前仅裁掉大部分外层透明区，仍保留少量安全边距，避免圆角贴边。
 */
export function resolveCompactIconCrop(size: { width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const side = Math.min(size.width, size.height)
  const inset = Math.round(side * 0.055)
  const croppedSide = Math.max(1, side - inset * 2)

  return {
    x: Math.floor((size.width - croppedSide) / 2),
    y: Math.floor((size.height - croppedSide) / 2),
    width: croppedSide,
    height: croppedSide,
  }
}
