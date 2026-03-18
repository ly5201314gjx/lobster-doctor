const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getOpenClawWorkspace } = require('../core/paths');
const { makeSummary, printList } = require('../core/report');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function scanLogText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const hits = {
    error: [],
    timeout: [],
    warn: [],
    fail: [],
    oom: [],
  };

  for (const line of lines) {
    if (/error/i.test(line)) hits.error.push(line);
    if (/timeout/i.test(line)) hits.timeout.push(line);
    if (/warn/i.test(line)) hits.warn.push(line);
    if (/fail/i.test(line)) hits.fail.push(line);
    if (/out of memory|heap limit|oom/i.test(line)) hits.oom.push(line);
  }

  for (const key of Object.keys(hits)) hits[key] = [...new Set(hits[key])];
  return hits;
}

function inspectTaskFiles(paths) {
  const result = {
    guardScripts: [],
    cronCandidates: [],
    monitorScripts: [],
    riskyLongTasks: [],
    healthChecks: [],
    notesCron: [],
  };

  for (const file of paths) {
    const normalized = String(file || '');
    const base = path.basename(normalized);

    if (/guard|lock|cooldown/i.test(base)) result.guardScripts.push(normalized);
    if (/cron|reminder|loop/i.test(base) || /\/notes\/cron\//i.test(normalized)) result.cronCandidates.push(normalized);
    if (/monitor|watchdog|health-check/i.test(base)) result.monitorScripts.push(normalized);
    if (/crawler|embedding|scan|sync/i.test(base)) result.riskyLongTasks.push(normalized);
    if (/health/i.test(base)) result.healthChecks.push(normalized);
    if (/\/notes\/cron\//i.test(normalized)) result.notesCron.push(normalized);
  }

  for (const key of Object.keys(result)) result[key] = [...new Set(result[key])];
  return result;
}

function analyzeTaskHealth({ logText, filePaths }) {
  const logs = scanLogText(logText);
  const files = inspectTaskFiles(filePaths);

  const good = [];
  const warnings = [];
  const bad = [];

  if (files.guardScripts.length) good.push(`发现守卫脚本: ${files.guardScripts.length} 个`);
  else warnings.push('没看到 guard / lock / cooldown 类守卫脚本');

  if (files.monitorScripts.length) good.push(`发现监控脚本: ${files.monitorScripts.length} 个`);
  else warnings.push('没看到 monitor / watchdog 类脚本');

  if (files.cronCandidates.length) good.push(`发现周期任务候选: ${files.cronCandidates.length} 个`);
  else warnings.push('没看到 cron / reminder / loop 类周期任务入口');

  if (files.notesCron.length) good.push(`发现 notes/cron 规划文件: ${files.notesCron.length} 个`);
  if (files.healthChecks.length) good.push(`发现健康检查入口: ${files.healthChecks.length} 个`);

  if (logs.error.length) bad.push(`最近日志出现 error: ${logs.error.length} 条`);
  if (logs.fail.length) bad.push(`最近日志出现 fail: ${logs.fail.length} 条`);
  if (logs.oom.length) bad.push(`最近日志出现 OOM: ${logs.oom.length} 条`);
  if (logs.timeout.length) warnings.push(`最近日志出现 timeout: ${logs.timeout.length} 条`);
  if (logs.warn.length) warnings.push(`最近日志出现 warn: ${logs.warn.length} 条`);

  if (files.riskyLongTasks.length) warnings.push(`检测到潜在长任务: ${files.riskyLongTasks.map((x) => path.basename(x)).join(', ')}`);

  let score = 100;
  score -= bad.length * 18;
  score -= warnings.length * 6;
  if (score < 0) score = 0;

  return makeSummary('task', score, good, warnings, bad, { logs, files, workspaceScriptCount: filePaths.length });
}

function collectWorkspaceTaskFiles(workspace) {
  const candidates = [];
  const searchRoots = [path.join(workspace, 'scripts'), path.join(workspace, 'notes', 'cron'), path.join(workspace, 'notes'), workspace];

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    const out = run(`find ${JSON.stringify(root)} -maxdepth 4 -type f \\( -name "*.sh" -o -name "*.py" -o -name "*.js" -o -name "*.md" \\) 2>/dev/null | head -n 300`);
    if (!out) continue;
    out.split('\n').map((x) => x.trim()).filter(Boolean).forEach((x) => candidates.push(x));
  }

  return [...new Set(candidates)].filter((file) => !/\/node_modules\//.test(String(file)) && !/\/\.git\//.test(String(file)));
}

function collectRecentLogs(workspace) {
  const files = ['/tmp/clawdbot', path.join(workspace, 'logs'), workspace];
  const chunks = [];
  for (const target of files) {
    if (!fs.existsSync(target)) continue;
    let cmd = '';
    if (fs.statSync(target).isDirectory()) cmd = `find ${JSON.stringify(target)} -maxdepth 2 -type f \\( -name "*.log" -o -name "*.txt" \\) 2>/dev/null | head -n 20 | xargs -r tail -n 20 2>/dev/null`;
    else cmd = `tail -n 50 ${JSON.stringify(target)} 2>/dev/null`;
    const out = run(cmd);
    if (out) chunks.push(out);
  }
  return chunks.join('\n');
}

function collectTaskReport() {
  const workspace = getOpenClawWorkspace();
  const filePaths = collectWorkspaceTaskFiles(workspace);
  const logText = collectRecentLogs(workspace);
  const report = analyzeTaskHealth({ logText, filePaths });
  report.workspace = workspace;
  return report;
}

function printTaskReport(report) {
  console.log('🩺 Lobster Doctor · task');
  console.log(`工作区: ${report.workspace}`);
  console.log(`任务脚本候选: ${report.workspaceScriptCount}`);
  console.log(`任务健康分: ${report.score}/100`);
  console.log(`状态: ${report.status}`);

  printList('正常项', '✅', report.good);
  printList('提醒项', '⚠️', report.warnings);
  printList('问题项', '❌', report.bad);

  const excerpts = [...report.logs.oom, ...report.logs.error, ...report.logs.fail, ...report.logs.timeout].slice(0, 8);
  if (excerpts.length) {
    console.log('\n🪵 日志摘录:');
    excerpts.forEach((line) => console.log(`- ${line}`));
  }

  console.log('\n建议动作:');
  if (!report.files.guardScripts.length) console.log('- 给长任务补 lock / cooldown / timeout 守卫，别裸跑');
  if (report.files.riskyLongTasks.length) console.log('- 给 crawler / embedding / scan 类任务加进度回报和硬超时');
  if (report.bad.length) console.log('- 先把日志里的 error/fail/OOM 收掉，再谈自动化扩容');
  if (!report.bad.length && !report.warnings.length) console.log('- 任务层现在算健康，可以继续加自动修复策略');
}

function runTask(options = {}) {
  const report = collectTaskReport();
  if (options.json) return report;
  printTaskReport(report);
  return report;
}

module.exports = { runTask, scanLogText, inspectTaskFiles, analyzeTaskHealth, collectWorkspaceTaskFiles, collectTaskReport };
