import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const configManagerSource = readFileSync('src/main/configManager.ts', 'utf-8')
const ipcSource = readFileSync('src/main/ipc.ts', 'utf-8')
const preloadSource = readFileSync('src/preload/index.ts', 'utf-8')
const appHeaderSource = readFileSync('src/renderer/src/shared/window/AppHeader.vue', 'utf-8')
const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')
const typesSource = readFileSync('src/renderer/src/shared/types/index.ts', 'utf-8')

test('配置管理保持轻量，不自动创建备份目录', () => {
  assert.equal(configManagerSource.includes('backupConfigFile'), false)
  assert.equal(configManagerSource.includes('getConfigBackupDir'), false)
  assert.equal(configManagerSource.includes('config-backups'), false)
  assert.equal(existsSync('src/main/configBackup.ts'), false)
})

test('界面和 IPC 不提供备份目录入口', () => {
  for (const source of [ipcSource, preloadSource, appHeaderSource, appSource, typesSource]) {
    assert.equal(source.includes('open-config-backup-dir'), false)
    assert.equal(source.includes('openConfigBackupDir'), false)
    assert.equal(source.includes('备份目录'), false)
    assert.equal(source.includes('自动备份'), false)
  }
})
