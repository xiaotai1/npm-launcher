import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/main/processManager.ts', 'utf-8')

test('项目启动环境使用项目目录读取项目级 npm 配置', () => {
  const envCalls = source.match(/getProjectEnv\(nodeVersion,\s*projectPath\)/g) || []

  assert.equal(envCalls.length, 2)
})

test('项目启动命令不通过 shell 拼接用户可控命令', () => {
  assert.equal(source.includes("spawn('cmd.exe', ['/c', `npm run ${command} 2>&1`]"), false)
  assert.equal(source.includes('shell: true'), false)
  assert.match(source, /spawn\(npmCommand,\s*\['run',\s*command\]/)
})
