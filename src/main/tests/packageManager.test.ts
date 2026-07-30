import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { detectPackageManager } from '../packageManager'

test('根据锁文件识别包管理器', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-manager-'))

  try {
    assert.equal(detectPackageManager(dir), 'npm')

    await writeFile(join(dir, 'pnpm-lock.yaml'), '')
    assert.equal(detectPackageManager(dir), 'pnpm')

    await rm(join(dir, 'pnpm-lock.yaml'), { force: true })
    await writeFile(join(dir, 'yarn.lock'), '')
    assert.equal(detectPackageManager(dir), 'yarn')

    await rm(join(dir, 'yarn.lock'), { force: true })
    await writeFile(join(dir, 'bun.lockb'), '')
    assert.equal(detectPackageManager(dir), 'bun')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('多个锁文件存在时使用确定的优先级', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-manager-'))

  try {
    await writeFile(join(dir, 'package-lock.json'), '')
    await writeFile(join(dir, 'pnpm-lock.yaml'), '')

    assert.equal(detectPackageManager(dir), 'pnpm')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
