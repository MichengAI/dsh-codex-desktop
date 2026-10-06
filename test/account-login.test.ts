import assert from 'node:assert/strict'
import test from 'node:test'

import { allowedLoginUrl, createAccountLoginSniffer, isLocalAccountSocket, loginUrlsFromPayload, platformLoginUrl } from '../src/account-login.js'

const LOGIN = 'https://platform.deepseek.com/login?x=1'

test('只接受 DeepSeek 官方 https 登录地址', () => {
  assert.equal(allowedLoginUrl(LOGIN), LOGIN)
  assert.equal(allowedLoginUrl('https://evil.example/login'), undefined)
  assert.equal(allowedLoginUrl('http://platform.deepseek.com/login'), undefined)
  assert.equal(allowedLoginUrl('https://user:pass@platform.deepseek.com/login'), undefined)
  assert.equal(allowedLoginUrl('javascript:alert(1)'), undefined)
})

test('从普通和再编码的账号消息中提取登录地址', () => {
  assert.deepEqual(loginUrlsFromPayload('phase waiting'), [])
  assert.deepEqual(loginUrlsFromPayload(`{"authorizeUrl":"${LOGIN}"}`), [LOGIN])
  assert.deepEqual(loginUrlsFromPayload('{"authorizeUrl":"https:\\/\\/platform.deepseek.com\\/login"}'), ['https://platform.deepseek.com/login'])
  assert.deepEqual(
    loginUrlsFromPayload(`{"data":"{\\"authorizeUrl\\":\\"${LOGIN}\\"}"}`),
    [LOGIN],
  )
})

test('登录地址带上当前主题', () => {
  assert.equal(platformLoginUrl(LOGIN, true), `${LOGIN}&theme=dark`)
})

test('同一登录地址在终态前只打开一次，不看帧间隔或消息 id', async () => {
  const opened: string[] = []
  let fail = false
  const sniffer = createAccountLoginSniffer(async url => {
    opened.push(url)
    if (fail) throw new Error('browser unavailable')
  }, () => true, () => {})
  fail = true
  sniffer.handleFrame(`{"phase":"waiting-browser","authorizeUrl":"${LOGIN}"}`)
  await Promise.resolve()
  fail = false
  sniffer.handleFrame(`{"phase":"waiting-browser","authorizeUrl":"${LOGIN}"}`)
  for (let index = 0; index < 5; index += 1) {
    sniffer.handleFrame(`{"phase":"waiting-browser","id":"${'a'.repeat(8)}${index}","authorizeUrl":"${LOGIN}"}`)
  }
  assert.equal(opened.length, 2)
  sniffer.handleFrame('{"phase":"cancelled"}')
  sniffer.handleFrame(`{"phase":"waiting-browser","authorizeUrl":"${LOGIN}"}`)
  assert.equal(opened.length, 3)
})

test('只把本机 DSH 连接当成登录通道', () => {
  assert.equal(isLocalAccountSocket('ws://127.0.0.1:8787/ws'), true)
  assert.equal(isLocalAccountSocket('wss://platform.deepseek.com/ws'), false)
  assert.equal(isLocalAccountSocket('not a url'), false)
})
