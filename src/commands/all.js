const fs = require('fs');
const { runConfig } = require('./config');
const { runDisk } = require('./disk');
const { runTask } = require('./task');
const { runSkill } = require('./skill');
const { calcStatus, exitCodeForStatus, finalizeReport } = require('../core/report');
const { loadBaseline, applyBaselineToReport, bundleToBaseline, saveBaseline } = require('../core/baseline');
const { printBaselineDiff, toMarkdown, sortedReports } = require('../core/format');

function section(title) {
  console.log(`\n${'='.repeat(18)} ${title} ${'='.repeat(18)}`);
}

function collectAllReport(target, options = {}) {
  const baseline = loadBaseline(options.baseline);
  const reports = {
    config: runConfig({ json: true }),
    disk: runDisk({ json: true }),
    task: runTask({ json: true }),
  };

  if (target) reports.skill = runSkill(target, { json: true });

  for (const key of Object.keys(reports)) {
    reports[key] = applyBaselineToReport(reports[key], baseline, options.onlyNew);
    reports[key] = finalizeReport(reports[key]);
  }

  const parts = Object.values(reports);
  const status = calcStatus({
    bad: parts.flatMap((x) => x.bad || []),
    warnings: parts.flatMap((x) => x.warnings || []),
  });

  const score = Math.round(parts.reduce((sum, part) => sum + (part.score || 0), 0) / parts.length);
  const summary = sortedReports({ reports }).map(([name, report]) => ({
    name,
    status: report.status,
    score: report.score,
    exitCode: report.meta?.exitCode ?? exitCodeForStatus(report.status),
    totalFindings: report.meta?.totalFindings || 0,
    counts: report.counts,
  }));

  const bundle = {
    name: 'all',
    status,
    score,
    reports,
    summary,
    exitCode: exitCodeForStatus(status),
    baseline: options.baseline || null,
    onlyNew: !!options.onlyNew,
  };

  if (options.writeBaseline) {
    saveBaseline(options.writeBaseline, bundleToBaseline(bundle));
    bundle.wroteBaseline = options.writeBaseline;
  }

  if (options.markdown) {
    fs.writeFileSync(options.markdown, toMarkdown(bundle));
    bundle.wroteMarkdown = options.markdown;
  }

  return bundle;
}

function printSummary(bundle) {
  console.log('🦞 Lobster Doctor · all');
  console.log(`总健康分: ${bundle.score}/100`);
  console.log(`总状态: ${bundle.status}`);
  if (bundle.baseline) console.log(`基线文件: ${bundle.baseline}`);
  if (bundle.onlyNew) console.log('模式: only-new（仅看新增问题）');
  if (bundle.wroteBaseline) console.log(`已写入基线: ${bundle.wroteBaseline}`);
  if (bundle.wroteMarkdown) console.log(`已写入 Markdown: ${bundle.wroteMarkdown}`);

  console.log('\n模块汇总:');
  bundle.summary.forEach((item) => {
    console.log(`- ${item.name}: status=${item.status} score=${item.score} exit=${item.exitCode} findings=${item.totalFindings} good=${item.counts.good} warn=${item.counts.warnings} bad=${item.counts.bad}`);
  });
}

function printAllReport(bundle, target, options = {}) {
  printSummary(bundle);
  if (options.quiet || options.summaryOnly) {
    for (const [name, report] of sortedReports(bundle)) {
      if (report.baseline) printBaselineDiff(name, report.baseline, options);
    }
    return;
  }

  section('config');
  runConfig();
  if (bundle.reports.config?.baseline) printBaselineDiff('config', bundle.reports.config.baseline, options);

  section('disk');
  runDisk();
  if (bundle.reports.disk?.baseline) printBaselineDiff('disk', bundle.reports.disk.baseline, options);

  section('task');
  runTask();
  if (bundle.reports.task?.baseline) printBaselineDiff('task', bundle.reports.task.baseline, options);

  if (target) {
    section(`skill ${target}`);
    runSkill(target);
    if (bundle.reports.skill?.baseline) printBaselineDiff('skill', bundle.reports.skill.baseline, options);
  } else {
    section('skill');
    console.log('跳过 skill：未提供 repo-or-dir');
    console.log('用法: lobster-doctor all <repo-or-dir>  # 可选附带技能验收');
  }
}

function runAll(target, options = {}) {
  const bundle = collectAllReport(target, options);
  if (options.json) return bundle;
  printAllReport(bundle, target, options);
  process.exitCode = bundle.exitCode;
  return bundle;
}

module.exports = { runAll, collectAllReport };
