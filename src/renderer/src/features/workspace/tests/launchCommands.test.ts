import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLaunchCommands } from '../model/launchCommands'

test('启动方案包含当前命令和 package scripts', () => {
  assert.deepEqual(buildLaunchCommands('dev', ['build', 'preview']), ['dev', 'build', 'preview'])
})

test('启动方案去重并忽略空命令', () => {
  assert.deepEqual(buildLaunchCommands(' dev ', ['dev', ' ', 'test']), ['dev', 'test'])
})
