import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { inspectProjectHealth } from '../projectHealth'

test('项目目录和启动脚本有效时健康检查通过', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-health-'))

  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      scripts: { dev: 'vite' }
    }))

    const result = inspectProjectHealth({
      id: 'admin',
      name: 'Admin',
      path: dir,
      command: 'dev'
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.issues, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('项目目录不存在时健康检查返回明确原因', () => {
  const result = inspectProjectHealth({
    id: 'admin',
    name: 'Admin',
    path: join(tmpdir(), 'npm-launcher-missing-project'),
    command: 'dev'
  })

  assert.equal(result.ok, false)
  assert.equal(result.issues[0].code, 'missing-project-path')
})

test('启动脚本不存在时健康检查返回明确原因', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-health-'))

  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      scripts: { build: 'vite build' }
    }))

    const result = inspectProjectHealth({
      id: 'admin',
      name: 'Admin',
      path: dir,
      command: 'dev'
    })

    assert.equal(result.ok, false)
    assert.equal(result.issues[0].code, 'missing-script')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
