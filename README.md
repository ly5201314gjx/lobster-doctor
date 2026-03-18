# Lobster Doctor

面向 OpenClaw / AI Runtime 的诊断型体检 CLI。

- **目标**：输出稳定、可复核的健康报告，用来定位“到底哪里坏了/该先修什么”
- **输出形态**：可读文本 + 机器可用 JSON + 可选 Markdown 报告
- **自动化友好**：稳定退出码（0/1/2），支持 baseline + only-new 压噪，只盯新增问题

---

## 环境要求

- Node.js >= 18

---

## 安装

### 方式 A：npm 全局安装

```bash
npm install -g lobster-doctor
```

### 方式 B：作为 OpenClaw 技能安装

```bash
bash install-for-openclaw.sh
```

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

## 退出码约定（适合 cron / CI 门禁）

- `0`：正常（OK）
- `1`：提醒（WARN，建议处理）
- `2`：问题（BAD，建议阻断/告警）

---

## 快速上手

### 1）跑一把聚合体检

```bash
lobster-doctor all ./some-skill
```

### 2）输出 JSON（给机器人/CI 消费）

```bash
lobster-doctor all ./some-skill --json
```

### 3）基线工作流（压掉旧问题，只看新增）

```bash
# 1) 生成基线
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json

# 2) 后续仅看新增问题
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### 4）导出 Markdown 报告

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

---

## 工具会检查什么

### `config`：OpenClaw 配置诊断

- 识别当前读取的配置文件（`openclaw.json` vs `config.json`）
- 抽取关键字段（模型、路由模式、Telegram stream 等）并做归一化
- 检测歧义/冲突写法（例如新旧字段同时存在）

### `skill`：技能仓库验收

- 检查仓库是否满足“可安装/可执行”的闭环（`package.json` / `SKILL.md` / `bin` 等）
- 检测常见坑（例如危险路径硬编码、安装脚本不可信等）

### `disk`：磁盘风险分级

- 统计 `$HOME` 目录下 Top 占用（基于 `du`）
- 将目录按风险分级为：**safe / caution / danger / review**
- 检测挂载点压力（基于 `df`），在阈值附近给出提醒

### `task`：长任务体检

- 识别常见 guard/monitor/watchdog 任务模式
- 扫描日志中的 `error / fail / timeout / OOM` 等信号
- 输出可执行的发现项（findings）

### `all`：聚合体检

- 运行 `config + disk + task`（若提供目标目录，则加上 `skill`）
- 输出稳定摘要表 + 可选 baseline diff

---

## 输出结构（统一报告模型）

所有模块输出都会被归一化为同一种结构：

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

`all --json` 额外返回：

- `summary[]`：模块级摘要（按严重程度排序）
- `reports{}`：每个模块的完整报告
- `exitCode`：聚合退出码（由聚合状态推导）

---

## 算法与规则（可复核、可解释）

本节记录当前实现的确定性规则，保证结果可解释、可调试。

### A）状态计算

```text
如果 bad.length > 0             => status = "bad"
否则如果 warnings.length > 0    => status = "warn"
否则                             => status = "ok"
```

退出码映射：

```text
ok   => 0
warn => 1
bad  => 2
```

### B）评分（score）

每个模块从 100 分起步，根据发现项数量扣分：

```text
score = 100
score -= badCount * 18
score -= warnCount * 6
score = clamp(score, 0, 100)
```

`all` 的总分为各模块分数的平均值（四舍五入）。

### C）baseline + only-new（压噪逻辑）

baseline 是“历史归一化报告快照”。

高层行为：

```text
读取 baseline
运行模块报告
如果 onlyNew:
  删除 baseline 中已出现过的发现项
输出 diff 摘要 + 剩余发现项
```

实现要点：

- baseline 是按模块应用的
- baseline 应用后会重新 finalize（重新计算 status/score/counts）

### D）disk 目录分级启发式

输入来源：

- `$HOME` Top 占用：`du -h -d 1 $HOME | sort -hr | head`
- 挂载点压力：`df -h <mount> | tail -n 1`

当前分类规则（简化描述）：

- `/.openclaw/` => **danger**（OpenClaw 配置/数据，禁止乱删）
- `/workspace` 或 `/projects` => **caution**（工作目录，删错容易事故）
- `/node_modules` => **caution**（可重装但会影响当前项目）
- 目录名属于 `{.cache, .npm, .bun, .cargo, .pnpm-store}` => **safe**（典型缓存，优先清）
- `Downloads / Desktop / Documents` => **caution**（用户内容目录，先确认）
- 其他 => **review**（需要人工判断用途）

挂载点压力阈值：

- `>= 90%`：提醒（高压）
- `>= 80%`：提醒（接近打满）

### E）config 检查（当前信号）

配置文件选择：

```text
从以下候选中，取第一个存在的：
  ~/.openclaw/openclaw.json
  ~/.openclaw/config.json
```

主模型归一化优先级：

```text
agents.defaults.model.primary
agents.defaults.model
agent.model
否则 "(未设置)"
```

Telegram stream 归一化：

```text
channels.telegram.streamMode
否则如果 channels.telegram.streaming 是 boolean => "legacy:true/false"
否则 "(未设置)"
```

已知值集合（用于可疑值提示）：

- `models.mode` 常见：`alias | direct | router`
- Telegram stream 常见：`edit | replace | final-only | off | legacy:true | legacy:false`

告警条件（当前）：

- Telegram 同时存在 `streamMode` 与 legacy `streaming`
- 读取到的配置是 `config.json`（可能不是实际生效配置）

---

## 开发与测试

### 运行测试

```bash
npm test
```

### 本地运行示例

```bash
node ./bin/lobster-doctor.js all --summary-only
```

---

## 许可证

MIT

---

## 附录：话术库（可选）

```text
工程版：OpenClaw / AI Runtime 诊断型体检 CLI，稳定输出（text/JSON/Markdown）+ baseline/only-new。
营销版：把“能跑”升级成“可诊断、可验证、可维护”，一条命令出报告接 cron/CI/机器人。
狂版：  别猜，用报告说话。
超短：  OpenClaw 体检：config/skill/disk/task + baseline 只看新增。
```
