# 项目级 Node 版本管理计划

## Context
当前 Node 版本切换是全局的（`nvm alias default`），导致所有项目共用一个版本。用户需要：
1. 每个项目可以独立设置 Node 版本
2. 启动项目/终端时自动使用该项目保存的版本
3. 版本偏好持久化，下次打开项目自动恢复
4. 两个平台（macOS + Windows）都支持项目级版本

## 核心思路

**macOS/Linux**：通过 PATH 覆盖实现。不调用 `nvm use`，而是把对应版本目录的 `bin` 路径插到 PATH 最前面。这样不同项目可以同时使用不同版本。

**Windows**：nvm-windows 只有全局 symlink，无法同时跑两个版本。启动项目时先切 symlink 到项目需要的版本，再启动进程。如果同时启动不同版本的项目，会有冲突——启动时给用户 toast 提醒。

## 实现步骤

### Step 1: 类型定义 — 添加 nodeVersion 字段

**文件**: [configManager.ts](src/main/configManager.ts) + [types/index.ts](src/renderer/src/types/index.ts)

Project 类型添加 `nodeVersion?: string` 字段（如 `"v18.20.0"`）。

### Step 2: 新增工具函数 — `getProjectEnv()`

**文件**: [platform.ts](src/main/platform.ts)

新增 `getProjectEnv(nodeVersion?: string): Promise<Record<string, string>>`：
- 调用 `getShellEnv()` 获取基础环境
- 如果指定了 nodeVersion 且版本目录存在，把版本 bin 路径 prepend 到 PATH
- macOS: `~/.nvm/versions/node/${nodeVersion}/bin`
- Windows: `${NVM_HOME}/${nodeVersion}`（去掉 v 前缀尝试）
- 版本目录不存在时 fallback 到默认 env

### Step 3: processManager — 使用项目级环境

**文件**: [processManager.ts](src/main/processManager.ts)

`startProject` 签名增加 `nodeVersion?: string` 参数：
- macOS: 用 `getProjectEnv(nodeVersion)` 替代 `getShellEnv()`
- Windows: 用 `getProjectEnv(nodeVersion)` 替代 `process.env`

### Step 4: ptyManager — 使用项目级环境

**文件**: [ptyManager.ts](src/main/ptyManager.ts)

`pty-spawn` 接收额外参数 `nodeVersion`：
- 用 `getProjectEnv(nodeVersion)` 替代 `getShellEnv()`

### Step 5: IPC 层改动

**文件**: [ipc.ts](src/main/ipc.ts)

- **`start-project`**: 接收额外 `nodeVersion` 参数，传给 `startProject()`
  - Windows: 启动前先检查是否需要切 symlink（如果当前 symlink 不是目标版本，先切）
- **`switch-node-version`**: **保留为全局切换**（Header 触发），行为不变
- **新增 `set-project-node-version`**: 仅更新项目配置中的 `nodeVersion` 字段，不改全局
- **`pty-spawn`**: 接收 `nodeVersion` 传给 ptyManager

### Step 6: Preload 桥接更新

**文件**: [preload/index.ts](src/preload/index.ts)

- `startProject` 增加可选 `nodeVersion` 参数
- `ptySpawn` 增加可选 `nodeVersion` 参数
- 新增 `setProjectNodeVersion(projectId, version)` 方法

### Step 7: 类型声明更新

**文件**: [types/index.ts](src/renderer/src/types/index.ts)

- Project 加 `nodeVersion` 字段
- `electronAPI` 添加 `setProjectNodeVersion` 声明
- `startProject` 和 `ptySpawn` 签名更新

### Step 8: UI — ProjectDetail 添加版本选择

**文件**: [ProjectDetail.vue](src/renderer/src/components/ProjectDetail.vue)

在命令行信息下方新增 Node 版本选择行：
- 显示「跟随系统」（未设置）或具体版本号（如 `v18.20.0`）
- 点击展开下拉框选择已安装版本
- 选择后 emit 事件保存到配置
- 新增 `nodeVersions` prop 和 `set-node-version` emit

### Step 9: App.vue 联动

**文件**: [App.vue](src/renderer/src/App.vue)

- `startProject()`: 传递 `selectedProject.nodeVersion` 给 IPC
- `Terminal` 组件: 传递 `nodeVersion` 给 `ptySpawn`
- 新增 `setProjectNodeVersion(id, version)` 方法：更新配置并保存
- ProjectDetail 绑定 `@set-node-version` 事件

## 文件改动清单

| 文件 | 改动 |
|------|------|
| [configManager.ts](src/main/configManager.ts) | Project 类型加 nodeVersion |
| [platform.ts](src/main/platform.ts) | 新增 `getProjectEnv()` |
| [processManager.ts](src/main/processManager.ts) | startProject 接受 nodeVersion |
| [ptyManager.ts](src/main/ptyManager.ts) | pty-spawn 接受 nodeVersion |
| [ipc.ts](src/main/ipc.ts) | 新增 handler + start-project 传参 |
| [preload/index.ts](src/preload/index.ts) | 桥接更新 + 新方法 |
| [types/index.ts](src/renderer/src/types/index.ts) | 类型更新 |
| [ProjectDetail.vue](src/renderer/src/components/ProjectDetail.vue) | 版本选择 UI |
| [App.vue](src/renderer/src/App.vue) | 事件处理 + 参数传递 |

## 验证方式

1. `npm run build` 编译通过
2. 项目 A 设置 Node 18，项目 B 设置 Node 20
3. 同时启动两个项目，分别在终端中 `node -v`，确认版本不同（macOS）
4. 关闭应用重新打开，版本偏好仍在
5. 不设置版本的项目默认使用系统全局版本
6. Windows 上验证 symlink 切换 + 启动流程
