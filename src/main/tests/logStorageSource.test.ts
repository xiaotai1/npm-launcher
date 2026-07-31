import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const logManagerSource = readFileSync('src/main/logManager.ts', 'utf-8')
const processManagerSource = readFileSync('src/main/processManager.ts', 'utf-8')
const ipcSource = readFileSync('src/main/ipc.ts', 'utf-8')
const preloadSource = readFileSync('src/preload/index.ts', 'utf-8')
const typesSource = readFileSync('src/renderer/src/shared/types/index.ts', 'utf-8')

test('主进程日志不再自动写入历史日志文件', () => {
  for (const forbidden of ['appendFileSync', 'mkdirSync', 'readdirSync', 'readFileSync', 'unlinkSync', 'statSync', "app.getPath('userData')", "'logs'"]) {
    assert.equal(logManagerSource.includes(forbidden), false)
  }
  assert.equal(processManagerSource.includes('startLogFile'), false)
  assert.equal(processManagerSource.includes('writeLog('), false)
  assert.equal(processManagerSource.includes('endLogFile'), false)
})

test('日志 IPC 不再暴露历史日志文件读取和目录入口', () => {
  for (const source of [ipcSource, preloadSource, typesSource]) {
    assert.equal(source.includes('get-log-files'), false)
    assert.equal(source.includes('getLogFiles'), false)
    assert.equal(source.includes('get-log-content'), false)
    assert.equal(source.includes('getLogContent'), false)
    assert.equal(source.includes('open-log-dir'), false)
    assert.equal(source.includes('openLogDir'), false)
  }
})
