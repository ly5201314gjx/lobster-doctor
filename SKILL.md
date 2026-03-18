---
name: lobster-doctor
description: OpenClaw / AI 运行时的健康检查与诊断技能（配套 CLI）。用于：排查 OpenClaw 配置是否生效、技能仓库能否安装、磁盘风险分级、长任务超时/OOM/失败信号扫描，并输出稳定的 text/JSON/Markdown 报告；支持 baseline/only-new 降噪，适合 cron/CI 门禁。触发词：体检、巡检、健康检查、healthcheck、诊断、排雷、config/disk/task/skill、baseline、only-new。
---

# Lobster Doctor（OpenClaw 技能）

这是一个**诊断型技能 + CLI 工具**。

- 技能侧：提供“什么时候用、怎么用、输出是什么”的稳定规范（用于被 OpenClaw 识别与触发）
- CLI 侧：负责确定性采集与分析（`lobster-doctor ...`）

## 安装到 OpenClaw（推荐）

```bash
bash install-for-openclaw.sh
```

安装完成后，目录一般为：

```text
~/.openclaw/skills/lobster-doctor
```

并通过 `npm link` 暴露命令 `lobster-doctor`。

## 常用命令

```bash
# 聚合体检（建议默认先跑它）
lobster-doctor all [repo-or-dir]

# 给自动化系统用
lobster-doctor all [repo-or-dir] --json

# baseline：先写入，再只看新增
lobster-doctor all [repo-or-dir] --json --write-baseline .lobster-baseline.json
lobster-doctor all [repo-or-dir] --baseline .lobster-baseline.json --only-new --summary-only

# 输出 Markdown 报告
lobster-doctor all [repo-or-dir] --json --markdown lobster-report.md

# 单模块
lobster-doctor config
lobster-doctor disk
lobster-doctor task
lobster-doctor skill /path/to/repo
```

## 输出与退出码

- 退出码：`0=正常`，`1=提醒`，`2=问题`（适合 cron/CI 门禁）
- 输出：文本（人读）/ JSON（机器消费）/ Markdown（报告）

> 详细算法与规则说明见仓库 README（工程版）。
