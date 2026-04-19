# NPM Launcher

一个基于 Electron + Vue 3 的桌面应用，用于可视化管理多个 NPM 项目的启动/停止/日志查看，同时集成了 nvm Node 版本管理功能。

## 功能特性

### 项目管理
- 添加/编辑/删除 NPM 项目（名称、路径、启动命令）
- 文件夹分组、收藏、拖拽排序
- 快速打开文件夹 / VS Code
- 项目搜索筛选

### 进程管理
- 一键启动/停止 `npm run <command>`
- 实时彩色日志流（stdout/stderr/info/error）
- 批量启动/停止所有项目
- Windows GBK 编码智能解码

### Node.js 版本管理
- 全局 Node 版本切换（nvm）
- 项目级 Node 版本设置（独立 PATH 隔离）
- 版本切换自动同步到所有终端

### 终端
- 内置 xterm.js 终端，支持 PTY 交互
- 复制/粘贴（Ctrl+Shift+C/V、右键）
- 跟随项目 Node 版本

### UI/UX
- 浅色/深色/系统 三种主题模式
- 磨砂玻璃侧边栏、药丸式状态徽章
- 悬停显示操作按钮、日志彩色指示条

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 29 | 桌面应用框架 |
| Vue 3.4 | 渲染进程 UI |
| TypeScript 5.3 | 类型安全 |
| electron-vite 2.0 | 构建工具 |
| xterm.js | 内嵌终端 |
| node-pty | PTY 交互 |
| electron-builder | 打包分发 |

## 快速开始

### 环境要求
- Node.js >= 18
- [nvm](https://github.com/nvm-sh/nvm)（用于 Node 版本管理功能）

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 打包发布
```bash
npm run dist        # 打包当前平台（自动版本号 +1）
npm run dist:win    # 打包 Windows（NSIS 安装包 + Portable）
npm run dist:mac    # 打包 macOS（DMG）
```

打包版本规则：

| 命令 | 版本变化 | 示例 |
|------|----------|------|
| `npm run dist` | patch +1 | 1.0.0 → 1.0.1 |
| `npm run dist -- --minor` | minor +1 | 1.0.0 → 1.1.0 |
| `npm run dist -- --major` | major +1 | 1.0.0 → 2.0.0 |
| `npm run dist:ask` | 交互式输入 | 提示输入版本号 |

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 窗口创建、应用生命周期
│   ├── ipc.ts               # IPC 处理器
│   ├── processManager.ts    # 进程管理（npm 启停、日志）
│   ├── ptyManager.ts        # PTY 终端管理
│   └── configManager.ts     # 配置持久化
├── preload/
│   └── index.ts             # 预加载桥接
└── renderer/                # 渲染进程（Vue 3）
    └── src/
        ├── App.vue
        ├── styles/main.css  # CSS 变量主题
        └── components/
            ├── Header.vue
            ├── ProjectList.vue
            ├── ProjectDetail.vue
            ├── LogConsole.vue
            └── Terminal.vue
```

## 安全

- `contextIsolation: true` + `nodeIntegration: false`
- 所有主进程通信通过 `contextBridge` + `ipcMain.handle`

## 许可证

MIT
