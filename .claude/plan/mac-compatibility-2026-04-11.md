# macOS 兼容性修复计划

## Context

项目当前仅适配 Windows，存在三个 macOS 兼容性问题：
1. 窗口左上角交通灯按钮被 Header 的 Logo/标题遮挡
2. NVM 版本管理完全不兼容（硬编码 Windows nvm-windows 逻辑，macOS 用 nvm-sh）
3. 终端(node-pty)报错（环境变量缺失导致 node/npm 不可用）

根因：项目 IPC 和进程管理全部基于 Windows nvm-windows（`NVM_HOME`/`NVM_SYMLINK`/`mklink /J`/PowerShell），macOS 上这些变量和命令都不存在。Electron 从 Dock 启动时不加载 shell profile，导致 `process.env` 中缺少 nvm PATH。

---

## 步骤 1：新建平台工具模块

**新建 `src/main/platform.ts`**

提供三个基础能力：
- `isMac` / `isWindows` 常量
- `getShellEnv()` — 通过登录 shell (`zsh -l -c env`) 获取完整环境变量（含 nvm PATH），带缓存。解决 Electron Dock 启动不加载 `.zshrc` 的核心问题
- `getNvmPaths()` — 跨平台返回 nvm 目录路径。Windows 用 `NVM_HOME`，macOS 用 `NVM_DIR` 或 `~/.nvm`，版本目录为 `$NVM_DIR/versions/node/`

---

## 步骤 2：修复 Header 交通灯遮挡

**修改文件：**
- `src/preload/index.ts` — 暴露 `platform: process.platform`
- `src/renderer/src/types/index.ts` — 类型声明添加 `platform: string`
- `src/renderer/src/components/Header.vue`：
  - 左侧 `.header-left` 在 macOS 上添加 `padding-left: 78px` 避开交通灯
  - 右侧 `.header-right` 在 macOS 上移除 `padding-right: 148px`（改为 `20px`，macOS 没有右侧 overlay 按钮）
- `src/main/ipc.ts` — `set-titlebar-overlay` handler 加 `process.platform !== 'win32'` 守卫

---

## 步骤 3：修复终端(node-pty)环境变量

**修改文件：**
- `src/main/index.ts` — `app.whenReady()` 中 macOS 预加载 shell 环境（`await getShellEnv()`）
- `src/main/ptyManager.ts` — `pty-spawn` handler 中用 `getShellEnv()` 替代 `process.env`，确保终端有完整 PATH
- `src/main/processManager.ts` — `startProject` 函数中非 Windows 分支使用 `getShellEnv()` 的环境执行 `npm run`

---

## 步骤 4：修复 NVM 版本管理跨平台

**修改文件：**
- `src/main/ipc.ts`（核心改动）：

| Handler | macOS 策略 |
|---------|-----------|
| `get-node-version` | 用 `getShellEnv()` 的环境执行 `node --version` |
| `get-node-versions` | 读 `$NVM_DIR/versions/node/` 目录，当前版本读 `$NVM_DIR/alias/default` 或 fallback `node --version` |
| `switch-node-version` | 通过 login shell 执行 `source nvm.sh && nvm use <version>`，不需要 sudo |

- `src/renderer/src/components/Header.vue` — 提示文本根据平台显示 `nvm ls-remote`（macOS）或 `nvm list available`（Windows）

---

## 文件修改清单

| 文件 | 操作 | 涉及问题 |
|------|------|---------|
| `src/main/platform.ts` | **新建** | 基础设施 |
| `src/preload/index.ts` | 修改 | 步骤2 |
| `src/renderer/src/types/index.ts` | 修改 | 步骤2 |
| `src/renderer/src/components/Header.vue` | 修改 | 步骤2、4 |
| `src/main/index.ts` | 修改 | 步骤3 |
| `src/main/ipc.ts` | 修改 | 步骤2、4 |
| `src/main/ptyManager.ts` | 修改 | 步骤3 |
| `src/main/processManager.ts` | 修改 | 步骤3 |

---

## 验证方式

1. `npm run dev` 启动开发模式
2. 验证问题1：Header 左上角交通灯不被遮挡，Logo/标题正常显示
3. 验证问题2：右上角显示当前 Node 版本，下拉列表能看到已安装版本，切换版本成功
4. 验证问题3：点击终端 Tab，能打开 shell 且 node/npm 命令可用
5. `npm run dist:mac` 打包 DMG，安装后重复上述验证
