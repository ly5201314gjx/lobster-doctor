# Lobster Doctor 技能

Lobster Doctor 是一个专门给 OpenClaw / AI 运行时做体检、巡检、排雷的命令行工具。

它能解决的核心问题：
- 配置改了但不知道有没有生效
- 一个 GitHub 仓库到底能不能装成技能
- 磁盘哪些能清、哪些千万别碰
- 长任务为什么超时、失败、OOM
- 已知问题太多，如何只盯新增问题

## 安装方式

### 方式一：一键安装到 OpenClaw 技能目录

```bash
bash install-for-openclaw.sh
```

### 方式二：通过 npm 全局安装

```bash
npm install -g lobster-doctor
```

安装后可直接使用：

```bash
lobster-doctor all
lobster-doctor task
lobster-doctor disk
lobster-doctor config
lobster-doctor skill /path/to/repo
```

## 推荐用法

### 完整体检

```bash
lobster-doctor all /path/to/repo
```

### 只看新增问题

```bash
lobster-doctor all /path/to/repo --baseline .lobster-baseline.json --only-new --summary-only
```

### 生成 Markdown 报告

```bash
lobster-doctor all /path/to/repo --json --markdown lobster-report.md
```
