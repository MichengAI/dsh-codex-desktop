import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import { apply } from '../src/desktop-bridge.mjs'

for (const scenario of [
  { name: '独立 Web', desktop: undefined, ipc: false, pnpm: undefined, expected: false },
  { name: '只有 pnpm 的 Web', desktop: undefined, ipc: false, pnpm: process.execPath, expected: false },
  { name: '其他 IPC 宿主', desktop: undefined, ipc: true, pnpm: process.execPath, expected: false },
  { name: '遗留 Desktop 环境变量', desktop: '1', ipc: false, pnpm: process.execPath, expected: false },
  { name: 'Desktop 缺少 pnpm', desktop: '1', ipc: true, pnpm: undefined, expected: false },
  { name: 'Desktop pnpm 路径失效', desktop: '1', ipc: true, pnpm: 'missing-pnpm.cjs', expected: false },
  { name: '正常 Desktop', desktop: '1', ipc: true, pnpm: process.execPath, expected: true },
]) {
  test(`${scenario.name} 按实际环境声明桌面服务`, () => {
    const previousEnv = { ...process.env }
    const send = process.send
    const connected = process.connected
    try {
      delete process.env.DSH_DESKTOP_HOST
      delete process.env.DSH_PNPM_ENTRY
      delete process.env.npm_execpath
      if (scenario.desktop) process.env.DSH_DESKTOP_HOST = scenario.desktop
      if (scenario.pnpm) process.env.DSH_PNPM_ENTRY = scenario.pnpm
      process.send = scenario.ipc ? (() => true) as typeof process.send : undefined
      process.connected = scenario.ipc
      const services: Record<string, unknown> = {}
      const ctx: Record<string, unknown> = { provide: (name: string, value: unknown) => { services[name] = value } }
      apply(ctx)
      assert.deepEqual(Object.keys(services), scenario.expected ? ['desktopProfiles', 'desktopPnpm'] : [])
      assert.equal(ctx.desktopProfiles !== undefined, scenario.expected)
      assert.equal(ctx.desktopPnpm !== undefined, scenario.expected)
      assert.equal(existsSync(process.execPath), true)
    } finally {
      process.env = previousEnv
      process.send = send
      process.connected = connected
    }
  })
}
