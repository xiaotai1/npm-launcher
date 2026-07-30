import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/main/ipc.ts', 'utf-8')

test('启动项目 IPC 不直接使用渲染进程传入的路径和命令', () => {
  assert.equal(source.includes('projectPath: string, command: string, nodeVersion?: string'), false)
  assert.equal(source.includes('project.id, project.path, project.command, project.nodeVersion'), false)
  assert.match(source, /resolveProjectRunRequest/)
})
