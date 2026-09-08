const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { spawnSync } = require('node:child_process')

const rootDir = path.join(__dirname, '..')
const versionFiles = [
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json'
]

function commandResult(command, args) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8'
  })
}

function resultMessage(result, fallback) {
  return (result.stderr || result.stdout || result.error?.message || fallback).trim()
}

function run(command, args, options = {}) {
  const result = commandResult(command, args)
  if (result.error || result.status !== 0) {
    throw new Error(resultMessage(result, `${command} 执行失败`))
  }
  if (options.showOutput) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stdout.write(result.stderr)
  }
  return (result.stdout || '').trim()
}

function git(args, options) {
  return run('git', args, options)
}

function ask(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())))
}

function parseVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`版本号格式错误：${version}，应为 X.Y.Z`)
  }
  return version.split('.').map(Number)
}

function nextPatch(version) {
  const [major, minor, patch] = parseVersion(version)
  return `${major}.${minor}.${patch + 1}`
}

function isGreaterVersion(next, current) {
  const nextParts = parseVersion(next)
  const currentParts = parseVersion(current)
  for (let index = 0; index < nextParts.length; index += 1) {
    if (nextParts[index] !== currentParts[index]) {
      return nextParts[index] > currentParts[index]
    }
  }
  return false
}

function latestReleaseTag() {
  const result = commandResult('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'])
  if (result.status === 0) return (result.stdout || '').trim()
  const message = resultMessage(result, '无法读取最近的发布 Tag')
  if (result.status === 128 && /No names found|No tags can describe/.test(message)) return ''
  throw new Error(message)
}

function commitNotesSince(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD'
  return git(['log', '--pretty=format:- %s', range])
}

function localTagExists(tag) {
  const result = commandResult('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
  if (result.status === 0) return true
  if (result.status === 1) return false
  throw new Error(resultMessage(result, `无法检查本地 Tag ${tag}`))
}

function remoteTagExists(tag) {
  const result = commandResult('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`])
  if (result.status === 0) return true
  if (result.status === 2) return false
  throw new Error(resultMessage(result, `无法检查远端 Tag ${tag}`))
}

function changedFiles() {
  const status = git(['status', '--porcelain', '--untracked-files=all'])
  if (!status) return []
  return status.split('\n').map(line => line.slice(3))
}

function assertOnlyVersionFilesChanged() {
  const changed = changedFiles()
  const unexpected = changed.filter(file => !versionFiles.includes(file))
  const missing = versionFiles.filter(file => !changed.includes(file))
  if (unexpected.length) {
    throw new Error(`版本同步期间出现其他改动：${unexpected.join('、')}，已停止提交`)
  }
  if (missing.length) {
    throw new Error(`以下版本文件没有更新：${missing.join('、')}，已停止提交`)
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('发布命令需要在交互式终端中运行')
  }

  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') {
    throw new Error('当前目录不是 Git 仓库')
  }
  const branch = git(['branch', '--show-current'])
  if (!branch) throw new Error('当前处于 detached HEAD，不能发布')
  const remote = git(['remote', 'get-url', 'origin'])
  if (git(['status', '--porcelain'])) {
    throw new Error('工作区不干净，请先提交或处理现有改动，再运行发布命令')
  }

  const currentVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version
  const defaultVersion = nextPatch(currentVersion)
  const previousTag = latestReleaseTag()
  const defaultNotes = commitNotesSince(previousTag)
  if (!defaultNotes) {
    throw new Error(`${previousTag || '当前仓库'}之后没有可发布的提交`)
  }

  console.log(`\n${previousTag ? `${previousTag} 之后` : '当前仓库'}的提交：\n${defaultNotes}\n`)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let version
  let notes
  let confirmed
  try {
    version = await ask(rl, `当前版本: ${currentVersion}\n请输入新版本号 (回车使用 ${defaultVersion}): `) || defaultVersion
    if (!isGreaterVersion(version, currentVersion)) {
      throw new Error(`新版本 ${version} 必须大于当前版本 ${currentVersion}`)
    }

    const tag = `v${version}`
    if (localTagExists(tag)) throw new Error(`本地已存在 Tag ${tag}`)
    if (remoteTagExists(tag)) throw new Error(`远端已存在 Tag ${tag}`)

    notes = await ask(rl, '请输入发布说明 (回车使用以上提交列表): ') || defaultNotes
    console.log('\n发布摘要')
    console.log(`远端: ${remote}`)
    console.log(`分支: ${branch}`)
    console.log(`版本: ${currentVersion} -> ${version}`)
    console.log(`提交: chore: 发布 ${tag}`)
    console.log(`Tag: ${tag}`)
    console.log(`发布说明:\n${notes}\n`)
    confirmed = await ask(rl, '确认创建版本提交、Tag 并推送吗？(y/N): ')
  } finally {
    rl.close()
  }

  if (!['y', 'yes'].includes(confirmed.toLowerCase())) {
    console.log('已取消发布，未修改任何文件')
    return
  }

  const tag = `v${version}`
  run(process.execPath, [path.join(__dirname, 'bump-version.js'), version], { showOutput: true })
  run(process.execPath, [path.join(__dirname, 'check-release-version.js'), tag], { showOutput: true })
  assertOnlyVersionFilesChanged()
  git(['add', '--', ...versionFiles])
  git(['commit', '-m', `chore: 发布 ${tag}`], { showOutput: true })
  if (git(['status', '--porcelain'])) {
    throw new Error('版本提交完成后工作区仍有改动，已停止创建 Tag')
  }
  git(['tag', '-a', tag, '-m', notes])

  try {
    git(['push', '--atomic', 'origin', 'HEAD', tag], { showOutput: true })
  } catch (error) {
    console.error(`\n远端未更新，本地提交和 ${tag} 已保留。修复问题后重试：`)
    console.error(`git push --atomic origin HEAD ${tag}\n`)
    throw error
  }

  console.log(`\n${tag} 已推送，GitHub Actions 发布流程已触发`)
}

main().catch(error => {
  console.error(`发布失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
