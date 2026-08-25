import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { resolveAppIconPath, resolveCompactIconCrop, resolveNotificationIconPath, resolveRasterIconPath, resolveTaskBadgeIconPath } from '../src/app-icon.js'

test('打包态优先使用 extraResources 中的 ico', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-icon-'))
  try {
    await writeFile(join(root, 'icon.ico'), 'ico')
    await writeFile(join(root, 'icon.png'), 'png')
    assert.equal(resolveAppIconPath({ appPath: root, isPackaged: true, resourcesPath: root }), join(root, 'icon.ico'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('开发态使用仓库 assets 图标', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-icon-dev-'))
  try {
    await mkdir(join(root, 'assets', 'icons'), { recursive: true })
    await writeFile(join(root, 'assets', 'icons', 'icon.ico'), 'ico')
    assert.equal(
      resolveAppIconPath({ appPath: root, isPackaged: false, resourcesPath: join(root, 'missing') }),
      join(root, 'assets', 'icons', 'icon.ico'),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('托盘优先使用 PNG，避免任务栏拿到过小的 ICO 帧', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-icon-raster-'))
  try {
    await writeFile(join(root, 'icon.ico'), 'ico')
    await writeFile(join(root, 'icon.png'), 'png')
    assert.equal(resolveRasterIconPath({ appPath: root, isPackaged: true, resourcesPath: root }), join(root, 'icon.png'))
    assert.equal(resolveAppIconPath({ appPath: root, isPackaged: true, resourcesPath: root }), join(root, 'icon.ico'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('托盘和任务栏裁掉应用图标的大部分透明边距，并保持居中正方形', () => {
  assert.deepEqual(resolveCompactIconCrop({ width: 512, height: 512 }), {
    x: 28,
    y: 28,
    width: 456,
    height: 456,
  })
  assert.deepEqual(resolveCompactIconCrop({ width: 600, height: 512 }), {
    x: 72,
    y: 28,
    width: 456,
    height: 456,
  })
})

test('任务栏未读标记按计数选择开发态和打包态资源', () => {
  assert.equal(
    resolveTaskBadgeIconPath({ appPath: 'D:\\app', isPackaged: false, resourcesPath: 'D:\\resources' }, 3),
    resolve('D:\\app', 'assets', 'task-badges', '3.png'),
  )
  assert.equal(
    resolveTaskBadgeIconPath({ appPath: 'D:\\app', isPackaged: true, resourcesPath: 'D:\\resources' }, 12),
    join('D:\\resources', 'task-badges', '9-plus.png'),
  )
})

test('Windows 通知来源使用紧凑图标资源', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-notification-icon-'))
  try {
    await writeFile(join(root, 'notification.ico'), 'ico')
    assert.equal(resolveNotificationIconPath({ appPath: root, isPackaged: true, resourcesPath: root }), join(root, 'notification.ico'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
