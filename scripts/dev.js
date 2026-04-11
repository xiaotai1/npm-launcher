// VS Code 等 Electron 应用的终端会设置 ELECTRON_RUN_AS_NODE=1，
// 导致 electron-vite 启动的 Electron 进程也继承此变量，
// 使其以普通 Node.js 模式运行而非 Electron 模式。
// 此脚本在启动 electron-vite 前删除该环境变量。
delete process.env.ELECTRON_RUN_AS_NODE

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// macOS: 修复 node-pty spawn-helper 的可执行权限
// npm install 后 prebuilds 中的 spawn-helper 可能缺少 +x 权限，导致 posix_spawnp 失败
if (process.platform === 'darwin') {
  const prebuildsDir = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds')
  if (fs.existsSync(prebuildsDir)) {
    const archDirs = fs.readdirSync(prebuildsDir).filter(d => d.startsWith('darwin'))
    for (const archDir of archDirs) {
      const helper = path.join(prebuildsDir, archDir, 'spawn-helper')
      if (fs.existsSync(helper)) {
        try {
          fs.chmodSync(helper, 0o755)
        } catch { /* ignore */ }
      }
    }
  }
}

execSync('electron-vite dev', { stdio: 'inherit' })
