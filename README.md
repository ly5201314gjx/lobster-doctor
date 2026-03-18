# Lobster Doctor

OpenClaw / AI Runtime diagnostics CLI.

- **Purpose**: produce consistent, reviewable health reports for OpenClaw runtimes and skill repos
- **Outputs**: human-readable text, machine-readable JSON, optional Markdown report
- **Automation**: stable exit codes (0/1/2), baseline + only-new to reduce recurring noise

## Requirements

- Node.js >= 18

## Installation

### Option A: npm global install

```bash
npm install -g lobster-doctor
```

### Option B: install as an OpenClaw skill

```bash
bash install-for-openclaw.sh
```

## CLI

```bash
lobster-doctor all [repo-or-dir] [--json] [--baseline file] [--only-new] [--write-baseline file] [--summary-only] [--quiet] [--markdown file]
lobster-doctor config [--json]
lobster-doctor skill <repo-or-dir> [--json]
lobster-doctor disk [--json]
lobster-doctor task [--json]
```

## Exit codes

- `0`: OK
- `1`: WARN (action recommended)
- `2`: BAD (clear problems detected)

## Quick start

### Run an aggregate check

```bash
lobster-doctor all ./some-skill
```

### JSON output (for bots/CI)

```bash
lobster-doctor all ./some-skill --json
```

### Baseline workflow (suppress known findings)

```bash
# 1) capture baseline
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json

# 2) later: only report new findings
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### Write Markdown report

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

## What the tool checks

### `config`: OpenClaw config diagnostics

- Detect the config file being read (`openclaw.json` vs `config.json`)
- Extract and validate key configuration signals
- Flag ambiguous or suspicious combinations (e.g. legacy + new fields present)

### `skill`: skill repo audit

- Verify skill repo shape and installability signals
- Detect common footguns (e.g. hard-coded dangerous paths)

### `disk`: disk risk classification

- Report top directory usage under `$HOME`
- Classify common directories into **safe/caution/danger/review**
- Warn when mount pressure approaches thresholds

### `task`: long-running task health

- Scan for common guard/monitor patterns
- Parse logs for error/timeout/OOM signals
- Summarize risk and produce actionable findings

### `all`: aggregate bundle

- Runs `config + disk + task (+ skill if target provided)`
- Emits a stable summary table + optional baseline diff

---

# Output model

All module reports are normalized into the same shape:

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

`all --json` returns:

- `summary[]`: per-module summary rows (sorted by severity)
- `reports{}`: full per-module reports
- `exitCode`: bundle exit code derived from bundle status

---

# Algorithms (deterministic rules)

This section documents the current implementation logic, so results are explainable and debuggable.

## A) Status calculation

A report status is derived from findings:

```text
if bad.length > 0      => status = "bad"
else if warnings.length > 0 => status = "warn"
else                    => status = "ok"
```

Exit code is derived from status:

```text
ok => 0
warn => 1
bad => 2
```

## B) Scoring

Each module starts at 100 and is penalized by finding counts:

```text
score = 100
score -= badCount * 18
score -= warnCount * 6
score = clamp(score, 0, 100)
```

The `all` bundle score is the mean of module scores (rounded).

## C) Baseline + only-new (noise suppression)

Baseline is a persisted, normalized report snapshot.

High-level behavior:

```text
load baseline
run module report
if onlyNew:
  remove findings that exist in baseline
emit diff summary + remaining findings
```

Implementation notes:

- baseline is applied per-module
- the report is finalized after baseline application (status/score/counts recalculated)

## D) Disk classification heuristics

Input:

- `$HOME` top entries via `du -h -d 1 $HOME | sort -hr | head`
- mount pressure via `df -h <mount> | tail -n 1`

Classification rules (current):

- `/.openclaw/` => **danger** (OpenClaw data/config)
- `/workspace` or `/projects` => **caution** (active work)
- `/node_modules` => **caution** (removable but disruptive)
- base in {`.cache`, `.npm`, `.bun`, `.cargo`, `.pnpm-store`} => **safe** (cache)
- `Downloads`, `Desktop`, `Documents` => **caution** (user content)
- otherwise => **review**

Mount pressure thresholds:

- `>= 90%` => warn: high pressure
- `>= 80%` => warn: approaching full

## E) Config checks (current signals)

Config file resolution:

```text
candidate = first existing of:
  ~/.openclaw/openclaw.json
  ~/.openclaw/config.json
```

Primary model normalization order:

```text
agents.defaults.model.primary
agents.defaults.model
agent.model
else "(未设置)"
```

Telegram stream normalization:

```text
channels.telegram.streamMode
else if channels.telegram.streaming is boolean => "legacy:true/false"
else "(未设置)"
```

Known value sets:

- `models.mode` expected in: `alias | direct | router`
- telegram expected in: `edit | replace | final-only | off | legacy:true | legacy:false`

Warnings:

- `channels.telegram.streamMode` and legacy `streaming` both set
- config file is `config.json` (may not be the actual effective config)

---

# Development

## Run tests

```bash
npm test
```

## Local usage

```bash
node ./bin/lobster-doctor.js all --summary-only
```

---

# License

MIT

---

# Appendix: Copy Bank (optional)

Engineering / marketing / short variants for sharing in chats or release notes.

```text
Engineering: OpenClaw / AI Runtime diagnostics CLI with stable reports (text/JSON/Markdown) + baseline/only-new.
Marketing:   Upgrade "it runs" into "it is diagnosable". One command outputs reports for cron/CI/bots.
Bold:        Stop guessing. Use reports.
Short:       OpenClaw healthcheck: config/skill/disk/task + baseline only-new.
```
