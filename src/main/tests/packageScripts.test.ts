import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readPackageScripts } from '../packageScripts'

test('读取 package.json 中定义的 scripts 名称', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-package-'))

  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      scripts: {
        dev: 'vite',
        build: 'vite build'
      }
    }))

    assert.deepEqual(readPackageScripts(dir), { scripts: ['dev', 'build'] })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('缺少 package.json 时返回空脚本和错误信息', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-launcher-package-'))

  try {
    assert.deepEqual(readPackageScripts(dir), {
      scripts: [],
      error: '该目录下没有 package.json'
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
