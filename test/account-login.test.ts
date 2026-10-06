import assert from 'node:assert/strict'
import test from 'node:test'

import { LOGIN_OPEN_TTL_MS, allowedLoginUrl, createAccountLoginSniffer, isLocalAccountSocket, loginUrlFromPayload, loginUrlsFromPayload, platformLoginUrl } from '../src/account-login.js'

const LOGIN = 'https://platform.deepseek.com/login?x=1'

test('只接受 DeepSeek 官方 https 登录地址', () => {
  assert.equal(allowedLoginUrl(LOGIN), LOGIN)
  assert.equal(allowedLoginUrl('https://evil.example/login'), undefined)
  assert.equal(allowedLoginUrl('http://platform.deepseek.com/login'), undefined)
  assert.equal(allowedLoginUrl('https://user:pass@platform.deepseek.com/login'), undefined)
  assert.equal(allowedLoginUrl('javascript:alert(1)'), undefined)
})

test('从普通和再编码的账号消息中提取登录地址', () => {
  assert.equal(loginUrlFromPayload('phase waiting'), undefined)
  assert.equal(loginUrlFromPayload(`{"authorizeUrl":"${LOGIN}"}`), LOGIN)
  assert.equal(loginUrlFromPayload('{"authorizeUrl":"https:\\/\\/platform.deepseek.com\\/login"}'), 'https://platform.deepseek.com/login')
  assert.deepEqual(
    loginUrlsFromPayload(`{"data":"{\\"authorizeUrl\\":\\"${LOGIN}\\"}"}`),
    [LOGIN],
  )
})

test('登录地址带上当前主题', () => {
  assert.equal(platformLoginUrl(LOGIN, true), `${LOGIN}&theme=dark`)
})

test('同一等待阶段不重复打开，失败或阶段结束后可以再开', async () => {
  const opened: string[] = []
  let fail = false
  let now = 1_000
  const sniffer = createAccountLoginSniffer(async url => {
    opened.push(url)
    if (fail) throw new Error('browser unavailable')
  }, () => true, () => now, () => {})
  const waiting = `{"phase":"waiting-browser","id":"attempt-1","authorizeUrl":"${LOGIN}"}`
  sniffer.handleFrame(waiting)
  sniffer.handleFrame(waiting)
  assert.deepEqual(opened, [`${LOGIN}&theme=dark`])
  fail = true
  now += LOGIN_OPEN_TTL_MS
  sniffer.handleFrame(waiting)
  await Promise.resolve()
  sniffer.handleFrame(waiting)
  assert.equal(opened.length, 3)
  sniffer.handleFrame('{"phase":"cancelled","id":"attempt-1"}')
  fail = false
  sniffer.handleFrame(waiting)
  assert.equal(opened.length, 4)
})

test('只把本机 DSH 连接当成登录通道', () => {
  assert.equal(isLocalAccountSocket('ws://127.0.0.1:8787/ws'), true)
  assert.equal(isLocalAccountSocket('wss://platform.deepseek.com/ws'), false)
  assert.equal(isLocalAccountSocket('not a url'), false)
})
