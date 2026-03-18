const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { analyzeDisk, classifyPath } = require('../src/commands/disk');
const { analyzeTaskHealth, inspectTaskFiles, scanLogText } = require('../src/commands/task');
const { collectAllReport } = require('../src/commands/all');
const { loadBaseline, applyBaselineToReport, bundleToBaseline } = require('../src/core/baseline');
const { printBaselineDiff, toMarkdown, sortedReports } = require('../src/core/format');

const root = path.resolve(__dirname, '..');
const bin = path.join(root, 'bin', 'lobster-doctor.js');
const fixtureSkill = path.join(__dirname, 'fixtures', 'min-skill');
const fixtureGoodConfig = path.join(__dirname, 'fixtures', 'config-good.json');
const fixtureRiskyConfig = path.join(__dirname, 'fixtures', 'config-risky.json');
const fixtureDiskHomeTop = fs.readFileSync(path.join(__dirname, 'fixtures', 'disk-home-top.txt'), 'utf-8');
const fixtureDiskMounts = fs.readFileSync(path.join(__dirname, 'fixtures', 'disk-mounts.txt'), 'utf-8');
const fixtureTaskLogs = fs.readFileSync(path.join(__dirname, 'fixtures', 'task-logs.txt'), 'utf-8');
const fixtureTaskFiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'task-files.json'), 'utf-8'));
const fixtureTaskFilesWorkspace = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'task-files-workspace.json'), 'utf-8'));
const fixtureBaseline = path.join(__dirname, 'fixtures', 'baseline-sample.json');
const fixtureBaselineDiff = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'baseline-diff-sample.json'), 'utf-8'));

function run(args = [], extra = {}) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf-8',
    ...extra,
  });
}

function createHomeWithConfig(sourceFile, targetName = 'openclaw.json') {
  const tempHome = path.join(root, `.tmp-test-home-${path.basename(sourceFile, '.json')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const openclawHome = path.join(tempHome, '.openclaw');
  fs.mkdirSync(openclawHome, { recursive: true });
  fs.copyFileSync(sourceFile, path.join(openclawHome, targetName));
  return tempHome;
}

test('shows help on unknown command', () => {
  const res = run(['wat']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /--summary-only/);
  assert.match(res.stdout, /--markdown file/);
});

test('baseline loader reads sample file', () => {
  const baseline = loadBaseline(fixtureBaseline);
  assert.equal(baseline.version, 1);
  assert.ok(baseline.items.task);
  assert.ok(baseline.items.config);
});

test('baseline application suppresses known findings in only-new mode', () => {
  const baseline = loadBaseline(fixtureBaseline);
  const report = {
    name: 'task',
    status: 'bad',
    score: 50,
    counts: { good: 0, warnings: 1, bad: 2 },
    good: [],
    warnings: ['检测到潜在长任务: qmd-embedding-monitor-run.sh, qmd-embedding-monitor.sh'],
    bad: ['最近日志出现 OOM: 4 条', '最近日志出现 fail: 2 条'],
  };
  const next = applyBaselineToReport(report, baseline, true);
  assert.equal(next.bad.length, 1);
  assert.equal(next.warnings.length, 0);
  assert.match(next.bad.join('\n'), /fail/);
  assert.equal(next.baseline.suppressedBad.length, 1);
});

test('baseline diff formatter prints summary and details', () => {
  let out = '';
  const orig = console.log;
  console.log = (...args) => { out += `${args.join(' ')}\n`; };
  try {
    printBaselineDiff('task', fixtureBaselineDiff, {});
  } finally {
    console.log = orig;
  }
  assert.match(out, /Baseline diff · task/);
  assert.match(out, /新增: 2 项/);
  assert.match(out, /已抑制: 2 项/);
  assert.match(out, /new bad/);
});

test('markdown formatter renders bundle report', () => {
  const bundle = collectAllReport(fixtureSkill);
  const md = toMarkdown(bundle);
  assert.match(md, /# Lobster Doctor Report/);
  assert.match(md, /## Summary/);
  assert.match(md, /## task/);
});

test('sorted reports put bad before warn before ok', () => {
  const sorted = sortedReports({
    reports: {
      okmod: { status: 'ok', meta: { totalFindings: 0 } },
      warnmod: { status: 'warn', meta: { totalFindings: 1 } },
      badmod: { status: 'bad', meta: { totalFindings: 2 } },
    },
  }).map(([name]) => name);
  assert.deepEqual(sorted, ['badmod', 'warnmod', 'okmod']);
});

test('all command runs aggregate report without skill target', () => {
  const res = run(['all']);
  assert.ok([0, 1, 2].includes(res.status));
  assert.match(res.stdout, /🦞 Lobster Doctor · all/);
  assert.match(res.stdout, /总健康分:/);
  assert.match(res.stdout, /总状态:/);
  assert.match(res.stdout, /模块汇总:/);
});

test('all command supports json output', () => {
  const res = run(['all', fixtureSkill, '--json']);
  assert.ok([0, 1, 2].includes(res.status));
  const json = JSON.parse(res.stdout);
  assert.equal(json.name, 'all');
  assert.equal(typeof json.score, 'number');
  assert.ok(Array.isArray(json.summary));
  assert.ok(json.reports.config);
  assert.ok(json.reports.disk);
  assert.ok(json.reports.task);
  assert.ok(json.reports.skill);
});

test('all command supports baseline and only-new flags', () => {
  const res = run(['all', fixtureSkill, '--json', '--baseline', fixtureBaseline, '--only-new']);
  assert.ok([0, 1, 2].includes(res.status));
  const json = JSON.parse(res.stdout);
  assert.equal(json.onlyNew, true);
  assert.equal(json.baseline, fixtureBaseline);
  assert.ok(json.reports.task.baseline);
});

test('all command can write baseline file', () => {
  const outFile = path.join(root, `.tmp-test-home-baseline-${Date.now()}.json`);
  const res = run(['all', fixtureSkill, '--json', '--write-baseline', outFile]);
  assert.ok([0, 1, 2].includes(res.status));
  const json = JSON.parse(res.stdout);
  assert.equal(json.wroteBaseline, outFile);
  const written = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
  assert.equal(written.version, 1);
  assert.ok(written.items.task);
});

test('all command supports summary-only mode', () => {
  const res = run(['all', fixtureSkill, '--summary-only']);
  assert.ok([0, 1, 2].includes(res.status));
  assert.match(res.stdout, /模块汇总:/);
  assert.doesNotMatch(res.stdout, /================== config ==================/);
});

test('all command supports markdown file output', () => {
  const mdFile = path.join(root, `.tmp-test-home-report-${Date.now()}.md`);
  const res = run(['all', fixtureSkill, '--json', '--markdown', mdFile]);
  assert.ok([0, 1, 2].includes(res.status));
  const json = JSON.parse(res.stdout);
  assert.equal(json.wroteMarkdown, mdFile);
  const md = fs.readFileSync(mdFile, 'utf-8');
  assert.match(md, /# Lobster Doctor Report/);
});

test('task command runs and prints health summary', () => {
  const res = run(['task']);
  assert.ok([0, 1, 2].includes(res.status));
  assert.match(res.stdout, /🩺 Lobster Doctor · task/);
  assert.match(res.stdout, /任务健康分:/);
  assert.match(res.stdout, /状态:/);
});

test('config command fails cleanly when config file is absent', () => {
  const tempHome = path.join(root, '.tmp-test-home');
  const res = spawnSync(process.execPath, [bin, 'config'], {
    cwd: root,
    encoding: 'utf-8',
    env: { ...process.env, HOME: tempHome },
  });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /未找到 OpenClaw 配置文件/);
});

test('config command reports healthy config clearly', () => {
  const tempHome = createHomeWithConfig(fixtureGoodConfig);
  const res = run(['config'], { env: { ...process.env, HOME: tempHome } });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /配置健康分: 100\/100/);
  assert.match(res.stdout, /状态: ok/);
  assert.match(res.stdout, /主模型已设置: glm-5/);
});

test('config command flags risky config and conflicts', () => {
  const tempHome = createHomeWithConfig(fixtureRiskyConfig, 'config.json');
  const res = run(['config', '--json'], { env: { ...process.env, HOME: tempHome } });
  assert.equal(res.status, 2);
  const json = JSON.parse(res.stdout);
  assert.equal(json.name, 'config');
  assert.equal(json.status, 'bad');
  assert.equal(typeof json.meta.exitCode, 'number');
  assert.match(json.warnings.join('\n'), /streamMode 和 legacy streaming/);
  assert.match(json.bad.join('\n'), /agents.defaults.model.primary 未设置/);
});

test('disk analyzer classifies common directories correctly', () => {
  assert.equal(classifyPath('/home/test/.cache').level, 'safe');
  assert.equal(classifyPath('/home/test/workspace').level, 'caution');
  assert.equal(classifyPath('/home/test/.openclaw').level, 'danger');
  assert.equal(classifyPath('/home/test/random-big-dir').level, 'review');
});

test('disk analyzer marks cleanup buckets and mount pressure', () => {
  const report = analyzeDisk({ homeTop: fixtureDiskHomeTop, mounts: fixtureDiskMounts });
  assert.equal(report.safe.length, 2);
  assert.equal(report.caution.length, 3);
  assert.equal(report.danger.length, 1);
  assert.equal(report.review.length, 0);
  assert.match(report.mountWarnings.join('\n'), /92%/);
  assert.equal(report.status, 'bad');
  assert.equal(report.meta.totalFindings, 3);
});

test('task log scanner extracts warn/error/fail/timeout signals', () => {
  const report = scanLogText(fixtureTaskLogs);
  assert.equal(report.warn.length, 1);
  assert.equal(report.error.length, 1);
  assert.equal(report.fail.length, 1);
  assert.equal(report.timeout.length, 1);
});

test('task file inspector detects guard, monitor and risky tasks', () => {
  const report = inspectTaskFiles(fixtureTaskFiles);
  assert.equal(report.guardScripts.length, 1);
  assert.equal(report.monitorScripts.length, 1);
  assert.equal(report.cronCandidates.length, 1);
  assert.equal(report.riskyLongTasks.length, 1);
});

test('task file inspector recognizes workspace-specific cron and health files', () => {
  const report = inspectTaskFiles(fixtureTaskFilesWorkspace);
  assert.ok(report.guardScripts.length >= 1);
  assert.ok(report.cronCandidates.length >= 2);
  assert.ok(report.monitorScripts.length >= 2);
  assert.ok(report.healthChecks.length >= 1);
  assert.ok(report.notesCron.length >= 1);
});

test('task health analyzer combines file and log signals', () => {
  const report = analyzeTaskHealth({ logText: fixtureTaskLogs, filePaths: fixtureTaskFiles });
  assert.ok(report.bad.length >= 2);
  assert.ok(report.warnings.length >= 2);
  assert.equal(report.status, 'bad');
  assert.match(report.good.join('\n'), /守卫脚本/);
  assert.match(report.warnings.join('\n'), /潜在长任务/);
});

test('aggregate collector returns summarized multi-report bundle', () => {
  const report = collectAllReport(fixtureSkill);
  assert.equal(report.name, 'all');
  assert.ok(report.reports.config);
  assert.ok(report.reports.disk);
  assert.ok(report.reports.task);
  assert.ok(report.reports.skill);
  assert.ok(Array.isArray(report.summary));
  assert.ok([0, 1, 2].includes(report.exitCode));
});

test('bundle can be converted back into baseline shape', () => {
  const report = collectAllReport(fixtureSkill);
  const baseline = bundleToBaseline(report);
  assert.equal(baseline.version, 1);
  assert.ok(baseline.items.config);
  assert.ok(baseline.items.task);
});

test('skill command audits a minimal good fixture', () => {
  const res = run(['skill', fixtureSkill, '--json']);
  assert.equal(res.status, 1);
  const json = JSON.parse(res.stdout);
  assert.equal(json.name, 'skill');
  assert.equal(json.pkgName, 'min-skill');
  assert.equal(json.status, 'warn');
  assert.equal(typeof json.meta.exitCode, 'number');
  assert.match(json.good.join('\n'), /存在 package.json/);
});

test('skill command validates required target arg', () => {
  const res = run(['skill', '--json']);
  assert.equal(res.status, 2);
  const json = JSON.parse(res.stdout);
  assert.match(json.bad.join('\n'), /用法: lobster-doctor skill/);
});
