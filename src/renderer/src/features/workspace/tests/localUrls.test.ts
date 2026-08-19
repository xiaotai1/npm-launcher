import assert from 'node:assert/strict'
import test from 'node:test'
import { findLocalUrls, normalizeLocalUrl } from '../model/localUrls'

test('从日志中识别本地访问地址', () => {
  assert.deepEqual(findLocalUrls('Local: http://localhost:5173/ ready'), ['http://localhost:5173'])
  assert.deepEqual(findLocalUrls('server at https://127.0.0.1:3000/app'), ['https://127.0.0.1:3000/app'])
})

test('忽略非本地地址并去重', () => {
  assert.deepEqual(findLocalUrls('https://example.com http://localhost:5173 http://localhost:5173'), ['http://localhost:5173'])
})

test('将 0.0.0.0 归一成 localhost', () => {
  assert.equal(normalizeLocalUrl('http://0.0.0.0:8080'), 'http://localhost:8080')
})

test('识别并归一化 IPv6 回环地址', () => {
  assert.deepEqual(findLocalUrls('Local: http://[::1]:5173/ ready'), ['http://localhost:5173'])
  assert.equal(normalizeLocalUrl('https://[::1]:8443/path'), 'https://localhost:8443/path')
})
