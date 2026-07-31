import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readme = readFileSync('README.md', 'utf-8')

test('README 日志说明与轻量化会话日志保持一致', () => {
  assert.equal(readme.includes('每次启动自动写入日志文件'), false)
  assert.equal(readme.includes('自动清理 30 天'), false)
  assert.match(readme, /本次会话/)
  assert.match(readme, /按需导出/)
})
