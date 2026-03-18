# Lobster Doctor 🦞

> **OpenClaw / AI Runtime 诊断型体检 CLI：一条命令输出可复核报告（text/JSON/Markdown），支持 baseline/only-new，适合 cron/CI 门禁。**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)](#测试)
[![GitHub Repo stars](https://img.shields.io/github/stars/ly5201314gjx/lobster-doctor?style=social)](https://github.com/ly5201314gjx/lobster-doctor)

你可能很熟：

- 配置改了半天，**到底有没有生效**？
- 一个仓库看起来像技能，结果装不上：**README / SKILL / bin 三套话术互相打架**。
- 磁盘快满了，但 `du/df` 一堆输出，**不知道哪些能删、哪些一碰就炸**。
- 长任务时不时超时 / OOM / fail，**出事时没人第一时间发现**。
- 告警天天响，最后变成纯噪音：你只想看 **“新增问题”**。

**Lobster Doctor** 就是干这个的：

> 一条命令出报告：给人看、给机器人吃、给 CI/cron 当门禁。

---

## Copy Bank（不同场景一句话）

> 你要“工程/克制/狂/营销”全都要：那就做成可复制的多版本话术。

**工程 & 克制（默认）**
```text
OpenClaw / AI Runtime 诊断型体检 CLI：一条命令输出可复核报告（text/JSON/Markdown），支持 baseline/only-new，适合 cron/CI 门禁。
```

**营销（产品感）**
```text
把“能跑”升级成“可诊断、可验证、可维护”。一条命令出报告，直接接 cron/CI/机器人通知。
```

**更狂（宣言版）**
```text
别猜配置、别猜技能、别猜磁盘、别猜任务死没死——用报告说话。
```

**超短（群里一句）**
```text
OpenClaw 体检工具：config/skill/disk/task 一把梭，支持 baseline 只看新增。
```

---

## 你会得到什么

- **可读输出**：一眼看懂“哪里坏了、该先修哪个”。
- **机器可用 JSON**：方便接通知、仪表盘、自动化。
- **Markdown 报告**：可以直接贴群/发 PR。
- **baseline / only-new**：把已知问题压掉，只盯新增异常。
- **统一退出码**：0/1/2 对应 OK/WARN/BAD，适合 cron/CI。

---

## 核心能力

### 1) `config` 配置诊断
把配置真相直接掀开（含风险提示/冲突字段/可疑写法）：

- 主模型/默认模型到底是谁
- 新旧字段混用、字段冲突
- 读到的到底是不是你以为的那个配置文件

### 2) `skill` 技能仓库验收
判断一个 repo **能不能真装成技能**：

- `package.json` / `SKILL.md` / `bin` 是否闭环
- 安装脚本是否靠谱
- 是否存在危险硬编码路径（例如 `/root/.openclaw` 这种）

### 3) `disk` 磁盘风险分级
不丢一坨 `du/df`，直接告诉你：

- 哪些是缓存（优先清）
- 哪些是谨慎区（要看一眼再动）
- 哪些是危险区（碰了可能事故）

### 4) `task` 长任务体检
专盯最容易“闷头出事”的那类任务：

- guard / lock / cooldown / monitor / watchdog / reminder / health-check
- 日志里的 `error / fail / timeout / OOM`

### 5) `all` 聚合巡检
一条命令出全量体检：

- 文本 / JSON / Markdown
- summary-only 摘要模式
- baseline / only-new

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

### 1) 跑一把完整体检

```bash
lobster-doctor all ./some-skill
```

### 2) 给自动化/机器人输出 JSON

```bash
lobster-doctor all ./some-skill --json
```

### 3) 建立基线，只看新增问题

```bash
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### 4) 导出 Markdown 巡检报告

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

---

## 退出码约定（适合 CI / cron）

- `0` = 正常
- `1` = 有提醒（建议看一眼）
- `2` = 明显问题（建议阻断/告警）

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

## 输出示例（summary-only）

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

---

## JSON 结果结构（给机器人/系统用）

每个模块统一结构，便于聚合：

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

---

## 适合谁

- 维护 OpenClaw 主机 / 工作站 / 自动化环境的人
- 需要给技能仓库做“能装/能跑/不坑人”验收的人
- 想把巡检接入 cron/CI，但不想每天被旧告警轰炸的人

---

## 测试

```bash
npm test
```

当前本地测试：**26 项通过**。

---

## 许可证

MIT
