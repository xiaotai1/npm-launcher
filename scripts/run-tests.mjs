import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { build } from 'esbuild'

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const tests = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      tests.push(...await findTests(path))
    } else if (entry.name.endsWith('.test.ts')) {
      tests.push(path)
    }
  }

  return tests
}

const testFiles = await findTests('src/renderer/src')
if (testFiles.length === 0) {
  console.error('No renderer tests found')
  process.exit(1)
}

const outputDirectory = await mkdtemp(join(tmpdir(), 'npm-launcher-tests-'))

try {
  const outputs = []
  for (const [index, testFile] of testFiles.entries()) {
    const output = join(outputDirectory, `${index}-${basename(testFile, '.ts')}.mjs`)
    await build({
      entryPoints: [testFile],
      bundle: true,
      format: 'esm',
      platform: 'node',
      sourcemap: 'inline',
      outfile: output
    })
    outputs.push(output)
  }

  const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
