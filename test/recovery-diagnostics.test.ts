import assert from 'node:assert/strict'
import test from 'node:test'

import { extractPluginFromStartupFailure, trimStartupLogForRecovery } from '../src/recovery-diagnostics.js'

test('从插件 patch 的启动异常中识别出疑似出错插件', () => {
  const message = 'file:///runtime/node_modules/@deepseek-ai/dsh/lib/index.js: dsh: failed to parse overlay D:\\profile\\node_modules\\@scope\\broken-plugin\\patch.yml: YAMLException'
  assert.equal(extractPluginFromStartupFailure(message), '@scope/broken-plugin')
})

test('从缺失依赖和原生模块错误中识别所属插件', () => {
  const missingModule = "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'sharp' imported from D:\\profile\\node_modules\\image-plugin\\dist\\index.js"
  const nativeModule = 'Error: \\?\\D:\\profile\\node_modules\\native-plugin\\build\\Release\\addon.node is not a valid Win32 application'
  assert.equal(extractPluginFromStartupFailure(missingModule), 'image-plugin')
  assert.equal(extractPluginFromStartupFailure(nativeModule), 'native-plugin')
})

test('诊断栈同时包含官方运行时和第三方插件时优先第三方插件', () => {
  const message = 'Error [ERR_MODULE_NOT_FOUND]: C:\\runtime\\node_modules\\@deepseek-ai\\dsh\\lib\\loader.js\nC:\\profile\\node_modules\\community-plugin\\dist\\index.js'
  assert.equal(extractPluginFromStartupFailure(message), 'community-plugin')
})

test('无法识别插件时不猜测，并裁剪过长启动日志', () => {
  assert.equal(extractPluginFromStartupFailure('DSH 提前退出（退出码 1）。'), undefined)
  assert.equal(trimStartupLogForRecovery('a'.repeat(20), 12), '…aaaaaaaaaaa')
})
