// VS Code 等 Electron 应用的终端会设置 ELECTRON_RUN_AS_NODE=1，
// 导致 electron-vite 启动的 Electron 进程也继承此变量，
// 使其以普通 Node.js 模式运行而非 Electron 模式。
// 此脚本在启动 electron-vite 前删除该环境变量。
delete process.env.ELECTRON_RUN_AS_NODE

const { execSync } = require('child_process')
execSync('electron-vite dev', { stdio: 'inherit' })
