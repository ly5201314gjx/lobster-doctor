# Lobster Doctor

> Turn OpenClaw from “it runs” into a system that is diagnosable, verifiable, and maintainable.

**Lobster Doctor** 是一个面向 OpenClaw / AI runtime 的体检与巡检 CLI：它不陪你聊天，它专门帮你揪出配置歧义、技能安装风险、磁盘清理雷区、长任务超时与 OOM 隐患。

## 这项目解决什么

Lobster Doctor 不是另一个聊天壳子，而是一个**体检官 / 验尸官 / 巡检官**。
它专门解决 4 类真实问题：

1. **配置真相**
   - 我明明改了，为什么没生效？
   - 当前模型 / think / runtime / stream 到底谁在起作用？

2. **技能验收**
   - 这个 GitHub 项目到底能不能装成技能？
   - README、SKILL、bin、路径、测试是否一致？

3. **磁盘清理**
   - 哪些缓存能删？
   - 哪些目录不能碰？
   - C/D/WSL 空间到底谁在吃？

4. **长任务守卫**
   - 为什么扫描会卡死？
   - 为什么 cron / workflow / 大任务总超时？

## MVP 命令

```bash
lobster-doctor all [repo-or-dir] [--json] [--baseline file] [--only-new] [--write-baseline file] [--summary-only] [--quiet] [--markdown file]
lobster-doctor config [--json]
lobster-doctor skill <repo-or-dir> [--json]
lobster-doctor disk [--json]
lobster-doctor task [--json]
```

## MVP 范围

### `config`
- 读取 `~/.openclaw/openclaw.json`（不存在时回退 `config.json`）
- 输出主模型、`models.mode`、Telegram stream 配置
- 标出常见冲突点：缺主模型、streamMode/legacy streaming 混用、可疑枚举值、读到了错误配置文件名

### `skill <dir>`
- 检查 `package.json` / `README.md` / `SKILL.md`
- 检查 bin 命令是否一致
- 检查是否存在 `/root/.openclaw` 硬编码
- 给出“可装成技能 / 有风险 / 待修复”结果

### `disk`
- 报告 WSL、C、D 卷容量
- 列出家目录大目录
- 对常见目录做风险分级：`安全可清 / 谨慎处理 / 禁止乱删 / 需要复核`
- 对高占用卷做容量告警（例如 80%+ / 90%+）

### `task`
- 巡检 `scripts/`、`notes/cron/`、workspace 根目录中的任务入口
- 识别 monitor、watchdog、guard、lock、cooldown、reminder、health-check 等现场脚本
- 扫描最近日志里的 `error / fail / timeout / warn`
- 标记潜在长任务（crawler / embedding / scan / sync）
- 给出 task 健康分和守卫建议

### `all [repo-or-dir]`
- 一次跑 `config + disk + task`
- 可选附带 `skill <repo-or-dir>` 验收
- 支持 `--json`，适合接 cron / CI / agent 自动巡检
- 支持 `--baseline file` 读取已知问题基线
- 支持 `--only-new` 只保留新增告警/问题
- 支持 `--write-baseline file` 把当前结果写成基线
- 支持 `--summary-only` 只输出总览和模块汇总
- 支持 `--quiet` 压缩文本输出
- 支持 `--markdown file` 写出 Markdown 报告
- 文本模式会显示 baseline diff（新增 / 已抑制）
- 根据总体状态返回退出码：`0=ok` / `1=warn` / `2=bad`

## 为什么这项目值得做

因为今天已经有真实需求证明它成立：
- 流式输出配置不透明
- 模型 thinking 档位容易混
- GitHub 项目要不要能装成技能得靠人肉验
- WSL / D 盘清理容易误伤
- 全盘扫描和长任务会超时

这不是 PPT 项目，是**今天就已经手工干过一遍的重复活**。

## 示例

### 1) 跑一把完整体检

```bash
lobster-doctor all ./some-skill
```

### 2) 生成机器可读 JSON

```bash
lobster-doctor all ./some-skill --json
```

### 3) 先写入基线，再只看新增问题

```bash
lobster-doctor all ./some-skill --json --write-baseline .lobster-baseline.json
lobster-doctor all ./some-skill --baseline .lobster-baseline.json --only-new --summary-only
```

### 4) 生成 Markdown 报告

```bash
lobster-doctor all ./some-skill --json --markdown lobster-report.md
```

## 下一步

- [x] 起 CLI 骨架
- [x] 起 4 个命令入口
- [x] 基础 smoke tests（help / config / skill / task）
- [x] 配置诊断规则第一版
- [ ] 技能验收规则第一版
- [x] 磁盘风险分级第一版
- [x] 长任务守卫设计稿（task 巡检第一版）
- [x] baseline / only-new / markdown / summary-only
