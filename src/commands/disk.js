const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { makeSummary } = require('../core/report');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function parseTopEntries(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\S+)\s+(.+)$/);
      if (!m) return null;
      return { size: m[1], dir: m[2] };
    })
    .filter(Boolean);
}

function classifyPath(dir) {
  const base = path.basename(dir);

  if (/\/(workspace|projects)(\/|$)/.test(dir)) {
    return { level: 'caution', reason: '工作目录，删错容易把项目干废' };
  }
  if (/\/.openclaw(\/|$)/.test(dir)) {
    return { level: 'danger', reason: 'OpenClaw 配置/数据目录，别乱碰' };
  }
  if (/\/(node_modules)(\/|$)/.test(dir)) {
    return { level: 'caution', reason: '依赖目录，可重装但删了会影响当前项目' };
  }
  if (['.cache', '.npm', '.bun', '.cargo', '.pnpm-store'].includes(base)) {
    return { level: 'safe', reason: '典型缓存目录，优先清这里' };
  }
  if (['Downloads', 'downloads'].includes(base)) {
    return { level: 'caution', reason: '下载目录，常有大文件，但先确认是否还要' };
  }
  if (['Desktop', 'Documents'].includes(base)) {
    return { level: 'caution', reason: '用户内容目录，别无脑删' };
  }

  return { level: 'review', reason: '大目录，但需要人工判断用途' };
}

function analyzeDisk({ homeTop, mounts }) {
  const entries = parseTopEntries(homeTop);
  const safe = [];
  const caution = [];
  const danger = [];
  const review = [];

  for (const entry of entries) {
    const item = { ...entry, ...classifyPath(entry.dir) };
    if (item.level === 'safe') safe.push(item);
    else if (item.level === 'caution') caution.push(item);
    else if (item.level === 'danger') danger.push(item);
    else review.push(item);
  }

  const mountWarnings = [];
  const mountLines = String(mounts || '').split('\n').map((x) => x.trim()).filter(Boolean);
  for (const line of mountLines) {
    const m = line.match(/^(.*?)(\d+)%\s*$/);
    if (!m) continue;
    const pct = Number(m[2]);
    if (pct >= 90) mountWarnings.push(`卷使用率过高: ${line}`);
    else if (pct >= 80) mountWarnings.push(`卷接近打满: ${line}`);
  }

  const good = [];
  const warnings = [];
  const bad = [];
  if (safe.length) good.push(`发现安全可清目录: ${safe.length} 个`);
  if (caution.length) warnings.push(`发现谨慎处理目录: ${caution.length} 个`);
  if (review.length) warnings.push(`发现需要复核目录: ${review.length} 个`);
  if (danger.length) bad.push(`发现禁止乱删目录: ${danger.length} 个`);
  mountWarnings.forEach((x) => warnings.push(x));

  let score = 100;
  score -= bad.length * 18;
  score -= warnings.length * 6;
  if (score < 0) score = 0;

  return makeSummary('disk', score, good, warnings, bad, {
    entries,
    safe,
    caution,
    danger,
    review,
    mountWarnings,
    mounts: mountLines,
  });
}

function printGroup(title, items) {
  if (!items.length) return;
  console.log(`\n${title}:`);
  items.forEach((item) => {
    console.log(`- ${item.size} ${item.dir} · ${item.reason}`);
  });
}

function collectDiskReport() {
  const mounts = ['/mnt/c', '/mnt/d', os.homedir()];
  const mountLines = mounts.map((m) => run(`df -h ${m} | tail -n 1`)).filter(Boolean);
  const home = os.homedir();
  const top = run(`du -h -d 1 ${home} 2>/dev/null | sort -hr | head -n 15`);
  return analyzeDisk({ homeTop: top, mounts: mountLines.join('\n') });
}

function printDiskReport(report) {
  console.log('🩺 Lobster Doctor · disk');
  report.mounts.forEach((line) => console.log(line));

  console.log('\n🏠 家目录 Top 占用:');
  if (report.entries.length) {
    report.entries.forEach((entry) => console.log(`${entry.size}\t${entry.dir}`));
  } else {
    console.log('(统计失败)');
  }

  console.log(`\n磁盘健康分: ${report.score}/100`);
  console.log(`状态: ${report.status}`);

  printGroup('✅ 安全可清', report.safe);
  printGroup('⚠️ 谨慎处理', report.caution);
  printGroup('⛔ 禁止乱删', report.danger);
  printGroup('🧐 需要复核', report.review);

  if (report.mountWarnings.length) {
    console.log('\n📦 容量告警:');
    report.mountWarnings.forEach((x) => console.log(`- ${x}`));
  }

  console.log('\n建议动作:');
  if (report.safe.length) console.log('- 先拿缓存目录开刀，收益最大、风险最低');
  if (report.danger.length) console.log('- `.openclaw` 这类目录先别碰，清错了直接出事故');
  console.log('- 真要删 workspace / Downloads 里的大文件，先人工确认再动手');
}

function runDisk(options = {}) {
  const report = collectDiskReport();
  if (options.json) return report;
  printDiskReport(report);
  return report;
}

module.exports = { runDisk, parseTopEntries, classifyPath, analyzeDisk, collectDiskReport };
