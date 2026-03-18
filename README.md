# Lobster Doctor

> **给 OpenClaw / AI 运行时做体检、巡检、排雷的专业 CLI。**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)](#测试)
[![GitHub Repo stars](https://img.shields.io/github/stars/ly5201314gjx/lobster-doctor?style=social)](https://github.com/ly5201314gjx/lobster-doctor)

**Lobster Doctor** 不是聊天壳子，也不是演示玩具。  
它是一个专门面向 **OpenClaw / AI runtime / 自动化任务系统** 的诊断型命令行工具——专治：

- 配置改了，但不知道到底有没有生效
- 一个 GitHub 仓库看起来像技能，实际上根本装不起来
- 磁盘空间快炸了，却不知道哪些能删、哪些不能碰
- 长任务时不时超时、失败、OOM，却没人第一时间发现
- 已知问题天天重复报警，把真正的新问题淹没掉

一句话：

> **把“能跑”升级成“可诊断、可验证、可维护、可巡检”。**

---

## 为什么这个项目值得看

现实里的 OpenClaw 维护，不是写完配置就万事大吉。
真正恶心人的，往往是这些问题：

- 你以为改的是生效配置，结果改错文件了
- 你以为某个仓库能一键装技能，结果 bin、README、SKILL 三套话术互相打架
- 你以为删的是缓存，结果删到了真数据
- 你以为任务只是“慢一点”，结果其实已经 OOM 或失败了
- 你以为告警很多说明监控很强，实际上只是噪音多到没人想看

**Lobster Doctor** 的目标，就是狠狠干掉这种模糊地带。

---

## 核心能力

### 🔧 配置诊断（config）
把配置真相直接掀开：
- 主模型有没有真正设置
- `models.mode` 是否可疑
- Telegram stream 配置是否暧昧
- 新旧字段是否混用
- 到底读的是不是你以为的那个配置文件

### 🧩 技能验收（skill）
判断一个仓库到底能不能装成技能：
- `package.json` / `README.md` / `SKILL.md` 是否齐全
- bin 命令是否真实可启动
- 安装脚本是否靠谱
- 有没有 `/root/.openclaw` 这种硬编码
- 文档和安装路径是否互相打脸

### 💽 磁盘风险分级（disk）
不是只给你一坨 `du` / `df` 输出，而是直接判断：
- 哪些属于缓存，可优先清
- 哪些属于谨慎区，别无脑删
- 哪些属于危险区，碰了容易出事故
- 哪些挂载点已经接近打满

### ⏱ 长任务体检（task）
盯住最容易闷头出事的那类任务：
- 守卫脚本 / lock / cooldown / monitor / watchdog / reminder / health-check
- 高风险长任务模式
- 日志中的 `error / fail / timeout / OOM`
- 哪些问题最脏、最该先处理

### 📊 聚合巡检（all）
一条命令，整套体检：
- 文本输出
- JSON 输出
- summary-only 摘要模式
- Markdown 报告导出
- 状态驱动退出码

### 🔕 基线与“只看新增问题”
让巡检真正可长期运行：
- 保存当前基线
- 压掉已知旧问题
- 只盯新增告警/异常
- 让定时巡检不再变成纯噪音发生器

---

## 命令总览

```bash
lobster-doctor all [repo-or-dir] [--json] [--baseline file] [--only-new] [--write-baseline file] [--summary-only] [--quiet] [--markdown file]
lobster-doctor config [--json]
lobster-doctor skill <repo-or-dir> [--json]
lobster-doctor disk [--json]
lobster-doctor task [--json]
```

---

## 最快上手

### 1）跑一把完整体检

```bash
lobster-doctor all ./some-skill
```

### 2）给自动化 / CI / 机器人输出 JSON

```bash
lobster-doctor all ./some-skill --json
```

### 3）写入基线，然后只看新增问题

```bash
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### 4）导出 Markdown 巡检报告

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

### 5）装进 OpenClaw 技能目录

```bash
bash install-for-openclaw.sh
```

---

## 一键安装

### 方式一：npm 全局安装

```bash
npm install -g lobster-doctor
```

### 方式二：安装成 OpenClaw 技能

```bash
bash install-for-openclaw.sh
```

安装完成后即可直接运行：

```bash
lobster-doctor all
lobster-doctor task
lobster-doctor disk
lobster-doctor config
lobster-doctor skill /path/to/repo
```

---

## 输出示例

### 摘要模式

```bash
lobster-doctor all ./some-skill --summary-only
```

```text
🦞 Lobster Doctor · all
总健康分: 74/100
总状态: bad

模块汇总:
- task: status=bad score=40 exit=2 findings=4 good=5 warn=1 bad=3
- disk: status=bad score=70 exit=2 findings=3 good=1 warn=2 bad=1
- config: status=warn score=88 exit=1 findings=2 good=1 warn=2 bad=0
- skill: status=warn score=96 exit=1 findings=1 good=12 warn=1 bad=0
```

### 退出码约定

- `0` = 正常
- `1` = 有提醒
- `2` = 有明显问题

这玩意儿非常适合：
- cron 定时任务
- CI / CD 健康门禁
- agent 自动巡检
- 机器人状态通知

---

## JSON 结果结构亮点

每个报告都会带统一结构：

```json
{
  "name": "task",
  "status": "bad",
  "score": 40,
  "counts": { "good": 5, "warnings": 1, "bad": 3 },
  "meta": {
    "status": "bad",
    "score": 40,
    "exitCode": 2,
    "counts": { "good": 5, "warnings": 1, "bad": 3 },
    "totalFindings": 4
  },
  "good": [],
  "warnings": [],
  "bad": []
}
```

`all --json` 还会额外提供：
- `summary[]`：模块级摘要列表
- `reports{}`：完整细节
- `exitCode`：总退出码

---

## 适合谁

Lobster Doctor 适合这些场景：

- 你在维护 OpenClaw 主机 / 工作站 / 自动化环境
- 你需要判断一个 GitHub 仓库到底能不能装成技能
- 你要给 AI 长任务做巡检和回归诊断
- 你需要生成能发给人看的巡检报告
- 你不想每天被旧问题重复轰炸，只想盯新增异常

---

## 当前状态

目前已具备：
- 配置诊断
- 技能验收
- 磁盘风险分级
- 长任务体检
- 聚合巡检
- JSON 输出
- Markdown 报告
- baseline / only-new
- summary-only / quiet
- 排序稳定
- 统一 summary schema
- 自动化测试覆盖

---

## 测试

```bash
npm test
```

当前本地测试状态：**26 项通过**。

---

## 路线图

接下来会继续补：
- 更深入的技能安装验证
- 更细的 finding 类型体系
- 更适合通知/机器人消费的摘要输出
- 更强的 OpenClaw 现场规则识别
- 更顺手的 CI / cron 默认工作流

---

## 许可证

MIT
