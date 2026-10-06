import assert from 'node:assert/strict'
import test from 'node:test'

import { loginUrlFromPayload, platformLoginUrl } from '../src/account-login.js'

test('从账号状态消息中提取登录地址', () => {
  assert.equal(loginUrlFromPayload('phase waiting'), undefined)
  assert.equal(
    loginUrlFromPayload('{"authorizeUrl":"https://platform.deepseek.com/login?x=1"}'),
    'https://platform.deepseek.com/login?x=1',
  )
  assert.equal(
    loginUrlFromPayload('{"authorizeUrl":"https:\\/\\/platform.deepseek.com\\/login"}'),
    'https://platform.deepseek.com/login',
  )
  assert.equal(loginUrlFromPayload('{"authorizeUrl":"javascript:alert(1)"}'), undefined)
})

test('登录地址带上当前主题', () => {
  assert.equal(
    platformLoginUrl('https://platform.deepseek.com/login', true),
    'https://platform.deepseek.com/login?theme=dark',
  )
})
