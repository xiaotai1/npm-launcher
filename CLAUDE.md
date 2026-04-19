# NPM Launcher - 项目说明

## 项目概述
NPM Launcher 是一个基于 Electron + Vue 3 的桌面应用，用于可视化管理多个 NPM 项目的启动/停止/日志查看，同时集成了 nvm Node 版本管理功能。

## 技术栈
- **框架**: Electron 29 + Vue 3.4
- **构建工具**: electron-vite 2.0 + Vite 5
- **语言**: TypeScript 5.3
- **打包**: electron-builder 24 (NSIS 安装包 + Portable 便携版)
- **字符编码**: iconv-lite (Windows GBK 日志解码)
- **提权**: electron-sudo (管理员权限执行 nvm 命令)

## 项目结构
```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 主进程入口（窗口创建、应用生命周期）
│   ├── configManager.ts     # 配置管理（读写 %APPDATA%/npm-launcher/config.json）
│   ├── ipc.ts               # IPC 处理器（所有 ipcMain.handle 注册）
│   ├── processManager.ts    # 进程管理（spawn 启动/停止 npm 项目，日志处理）
│   └── sudoExecutor.ts      # 提权执行器（electron-sudo 封装）
├── preload/
│   └── index.ts             # 预加载脚本（contextBridge 暴露 API）
└── renderer/                # 渲染进程（Vue 3）
    ├── index.html
    └── src/
        ├── main.ts          # Vue 入口
        ├── App.vue          # 根组件
        ├── types/index.ts   # TypeScript 类型声明
        ├── styles/main.css  # 全局样式 + CSS 变量主题
        └── components/
            ├── Header.vue         # 顶栏（Node 版本显示、主题切换）
            ├── ProjectList.vue    # 左侧项目列表
            ├── ProjectDetail.vue  # 项目详情（编辑/启动/停止）
            └── LogConsole.vue     # 日志控制台
```

## 已实现功能

### 1. 项目管理
- 添加/编辑/删除 NPM 项目（名称、路径、启动命令）
- 项目配置持久化到 `%APPDATA%/npm-launcher/config.json`
- 支持自定义 npm script 命令

### 2. 进程管理
- 通过 `child_process.spawn` 启动 `npm run <command>`
- 实时日志流（stdout/stderr），带时间戳前缀
- Windows GBK 编码智能解码（iconv-lite）
- ANSI 转义序列清理
- 进程状态管理（running/stopped/error）
- Windows 进程树强制终止（taskkill /f /t）
- 手动停止与异常退出的区分

### 3. Node.js 版本管理（nvm）
- 获取当前 Node 版本（`node --version`）
- 获取 nvm 已安装版本列表（`nvm list`）
- 切换 Node 版本（`nvm use <version>`，通过 electron-sudo 提权）

### 4. UI/UX
- 浅色/深色/系统 三种主题模式（CSS 变量切换）
- 响应式布局，左右分栏
- 日志控制台支持清空和自动滚动

## IPC 通信协议

| Channel | 方向 | 功能 |
|---|---|---|
| `get-config` | renderer → main | 获取应用配置 |
| `save-config` | renderer → main | 保存应用配置 |
| `add-project` | renderer → main | 添加项目 |
| `update-project` | renderer → main | 更新项目 |
| `delete-project` | renderer → main | 删除项目 |
| `get-node-version` | renderer → main | 获取当前 Node 版本 |
| `get-node-versions` | renderer → main | 获取 nvm 已安装版本列表 |
| `switch-node-version` | renderer → main | 切换 Node 版本（提权） |
| `start-project` | renderer → main | 启动项目 npm 进程 |
| `stop-project` | renderer → main | 停止项目进程 |
| `get-process-status` | renderer → main | 获取项目进程状态 |
| `log-data` | main → renderer | 推送日志数据 |
| `process-status` | main → renderer | 推送进程状态变更 |

## 安全架构
- `contextIsolation: true` + `nodeIntegration: false`
- 所有主进程通信通过 `contextBridge.exposeInMainWorld` + `ipcMain.handle`

## 开发命令
```bash
npm run dev       # 开发模式（热重载）
npm run build     # 编译
npm run dist      # 打包当前平台（自动 patch 版本 +1）
npm run dist:win  # 打包 Windows 安装包（自动 patch 版本 +1）
npm run dist:mac  # 打包 macOS 安装包（自动 patch 版本 +1）
```

## 打包版本规则
打包时会自动递增 `package.json` 中的版本号，通过 `scripts/bump-version.js` 实现：

| 命令 | 版本变化 | 示例 |
|------|----------|------|
| `npm run dist` | patch +1 | 1.0.0 → 1.0.1 |
| `npm run dist -- --minor` | minor +1 | 1.0.0 → 1.1.0 |
| `npm run dist -- --major` | major +1 | 1.0.0 → 2.0.0 |
| `npm run dist:ask` | 交互式输入 | 提示输入新版本号 |

## 关键配置
- 配置文件路径: `%APPDATA%/npm-launcher/config.json`
- Electron 下载镜像: `https://npmmirror.com/mirrors/electron/`
- npm 镜像: 见 `.npmrc`
