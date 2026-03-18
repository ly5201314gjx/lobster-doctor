# Lobster Doctor

> **The healthcheck CLI for OpenClaw runtimes, skills, disks, and long-running AI tasks.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/badge/tests-26%20passing-brightgreen)](#testing)
[![GitHub Repo stars](https://img.shields.io/github/stars/ly5201314gjx/lobster-doctor?style=social)](https://github.com/ly5201314gjx/lobster-doctor)

**Lobster Doctor** turns OpenClaw from **“it runs”** into something **diagnosable, verifiable, and maintainable**.

It is not another chat shell. It is a purpose-built **inspection and diagnostics CLI** that helps you:
- expose config ambiguity before it bites,
- audit whether a repo is actually installable as a skill,
- identify safe vs dangerous disk cleanup targets,
- catch long-task timeout / OOM / failure patterns,
- baseline known issues and report **only new problems**.

---

## Why this exists

Real OpenClaw work gets messy fast:
- a config was changed, but not the one actually taking effect,
- a GitHub repo *looks* like a skill, but the install path is fake,
- disk cleanup risks deleting real data instead of caches,
- long-running workflows silently time out, stall, or die with OOM,
- recurring known issues drown out the new stuff that actually matters.

**Lobster Doctor** exists to kill that ambiguity.

---

## Core features

### 🔧 Config diagnostics
Audit the live config shape and flag common ambiguity:
- missing primary model,
- suspicious `models.mode`,
- suspicious Telegram stream settings,
- mixed legacy/new stream fields,
- wrong config filename taking effect.

### 🧩 Skill installability audit
Verify whether a repo is actually ready to be installed as a skill:
- `package.json` / `README.md` / `SKILL.md` presence,
- bin mapping and smoke startup,
- install script sanity,
- hardcoded `/root/.openclaw` paths,
- docs/install mismatch.

### 💽 Disk risk classification
Stop deleting the wrong thing:
- classify cache vs caution vs danger directories,
- surface high-usage mounts,
- summarize cleanup risk instead of dumping raw `du` noise.

### ⏱ Task health diagnostics
Inspect long-running AI and automation workloads:
- detect guard / lock / cooldown / monitor / reminder / health-check scripts,
- surface risky long-task patterns,
- scan logs for `error`, `fail`, `timeout`, and **OOM**,
- prioritize the nastiest findings first.

### 📊 Aggregate reporting
Run one command and get a whole-system inspection:
- human-readable terminal output,
- machine-readable JSON,
- summary-only mode,
- markdown report generation,
- status-aware exit codes.

### 🔕 Baseline + only-new mode
Make recurring known problems boring again:
- save a baseline,
- suppress known warnings/errors,
- report only new findings,
- keep long-term healthchecks useful instead of noisy.

---

## CLI commands

```bash
lobster-doctor all [repo-or-dir] [--json] [--baseline file] [--only-new] [--write-baseline file] [--summary-only] [--quiet] [--markdown file]
lobster-doctor config [--json]
lobster-doctor skill <repo-or-dir> [--json]
lobster-doctor disk [--json]
lobster-doctor task [--json]
```

---

## Quickstart

### Run a full inspection

```bash
lobster-doctor all ./some-skill
```

### Get JSON for automation / CI / bots

```bash
lobster-doctor all ./some-skill --json
```

### Write a baseline, then only report new issues

```bash
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### Generate a markdown report

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

---

## Example output

### Summary-only mode

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

### Exit codes

- `0` = ok
- `1` = warn
- `2` = bad

Perfect for cron jobs, CI, and agent orchestration.

---

## JSON schema highlights

Each report exposes a stable structure:

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

Aggregate `all --json` also returns:
- `summary[]` for compact module rollup,
- `reports{}` for full detail,
- `exitCode` for machine decisions.

---

## Use cases

Lobster Doctor is especially useful when you need to:
- validate whether a repo is truly skill-installable,
- audit an OpenClaw machine before or after config changes,
- monitor long-running AI jobs for timeout / OOM regressions,
- generate health reports for operators,
- suppress old known issues and focus only on new breakage.

---

## Project status

Current release already includes:
- config diagnostics,
- skill audit,
- disk classification,
- task health checks,
- aggregate inspection,
- JSON output,
- markdown output,
- baseline / only-new support,
- sorted reporting,
- automated test coverage.

---

## Testing

```bash
npm test
```

Current local smoke/analyzer coverage: **26 passing tests**.

---

## Roadmap

- deeper skill install verification,
- richer finding taxonomy,
- summary-focused report modes,
- CI/cron-ready default workflows,
- stronger OpenClaw-aware heuristics.

---

## License

MIT
