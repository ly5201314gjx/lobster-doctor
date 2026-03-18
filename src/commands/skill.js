const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeSummary, printList } = require('../core/report');

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return { __error: err.message };
  }
}

function walkTextFiles(dir, maxDepth = 3) {
  const out = [];
  const allowed = new Set(['.md', '.js', '.json', '.sh', '.yml', '.yaml', '.txt']);
  function visit(current, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        visit(full, depth + 1);
      } else if (entry.isFile()) {
        if (allowed.has(path.extname(entry.name).toLowerCase())) out.push(full);
      }
    }
  }
  visit(dir, 0);
  return out;
}

function verdict(score) {
  if (score >= 85) return '✅ 可直接冲一键装技能';
  if (score >= 65) return '⚠️ 基本可用，但还有坑';
  return '❌ 现在不建议无脑安装';
}

function smokeNodeBin(dir, relPath) {
  const full = path.join(dir, relPath);
  if (!exists(full)) return { ok: false, reason: `bin 文件不存在: ${relPath}` };
  const candidates = [['--version'], ['--help']];
  for (const args of candidates) {
    const res = spawnSync('node', [full, ...args], { cwd: dir, encoding: 'utf-8', timeout: 6000 });
    if (res.status === 0) {
      const first = (res.stdout || '').trim().split('\n')[0] || '(有输出)';
      return { ok: true, reason: `bin smoke ok: node ${relPath} ${args.join(' ')} -> ${first}` };
    }
    const combined = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
    if (/Cannot find module/i.test(combined)) return { ok: false, reason: `bin 运行失败，依赖未安装: ${combined.split('\n')[0]}` };
    if (/timeout/i.test(String(res.error?.message || ''))) return { ok: false, reason: `bin smoke 超时: node ${relPath} ${args.join(' ')}` };
  }
  return { ok: false, reason: `bin smoke 失败: ${relPath}` };
}

function checkInstallScript(file) {
  const txt = readText(file);
  const good = [];
  const warnings = [];
  if (!txt) return { good, warnings };
  if (/npm link/.test(txt)) good.push(`${path.basename(file)} 包含 npm link`);
  else warnings.push(`${path.basename(file)} 未看到 npm link`);
  if (/git clone/.test(txt) || /ln -sf/.test(txt)) good.push(`${path.basename(file)} 提供了源码安装路径`);
  else warnings.push(`${path.basename(file)} 未看到 clone/symlink 安装逻辑`);
  if (/npm install commander --no-save/.test(txt)) warnings.push(`${path.basename(file)} 仍在只安装 commander，建议改成 npm install`);
  return { good, warnings };
}

function collectSkillReport(target) {
  if (!target) {
    return makeSummary('skill', 0, [], [], ['用法: lobster-doctor skill <repo-or-dir>'], { target: null, pkgName: null, verdict: verdict(0) });
  }

  const dir = path.resolve(target);
  if (!exists(dir)) {
    return makeSummary('skill', 0, [], [], [`目录不存在: ${dir}`], { target: dir, pkgName: null, verdict: verdict(0) });
  }

  const pkgFile = path.join(dir, 'package.json');
  const readmeFile = path.join(dir, 'README.md');
  const skillFile = path.join(dir, 'SKILL.md');
  const installOpenClaw = path.join(dir, 'install-for-openclaw.sh');
  const installLegacy = path.join(dir, 'install.sh');
  const installAlt = path.join(dir, 'install-openclaw-flow.sh');

  const good = [];
  const warnings = [];
  const bad = [];

  if (exists(pkgFile)) good.push('存在 package.json'); else bad.push('缺少 package.json');
  if (exists(readmeFile)) good.push('存在 README.md'); else bad.push('缺少 README.md');
  if (exists(skillFile)) good.push('存在 SKILL.md'); else bad.push('缺少 SKILL.md');

  let pkg = null;
  if (exists(pkgFile)) {
    pkg = safeReadJson(pkgFile);
    if (pkg.__error) {
      bad.push(`package.json 解析失败: ${pkg.__error}`);
      pkg = null;
    }
  }

  if (pkg) {
    const binKeys = pkg.bin ? Object.keys(pkg.bin) : [];
    if (!pkg.bin) bad.push('package.json 缺少 bin 命令定义');
    else good.push(`bin 命令: ${binKeys.join(', ')}`);
    if (!pkg.description) warnings.push('package.json 缺少 description');
    if (!pkg.scripts?.test) warnings.push('未定义 test 脚本'); else good.push(`test 脚本: ${pkg.scripts.test}`);
    if (pkg.bin) {
      for (const [name, rel] of Object.entries(pkg.bin)) {
        const targetFile = path.join(dir, rel);
        if (!exists(targetFile)) {
          bad.push(`bin 指向的文件不存在: ${name} -> ${rel}`);
          continue;
        }
        const smoke = smokeNodeBin(dir, rel);
        if (smoke.ok) good.push(`${name} 可启动: ${smoke.reason}`);
        else bad.push(`${name} 启动失败: ${smoke.reason}`);
      }
    }
  }

  const readme = readText(readmeFile);
  const skill = readText(skillFile);
  if (readme) {
    if (readme.includes('install-for-openclaw.sh')) good.push('README 提供了 install-for-openclaw.sh 一键安装');
    if (readme.includes('clawhub install')) good.push('README 提供了 clawhub 安装说明');
    if (readme.includes('install.sh') && !exists(installLegacy) && !readme.includes('install-for-openclaw.sh')) warnings.push('README 提到了 install.sh，但仓库里没有这个脚本');
  }
  if (skill) {
    if (skill.includes('clawhub install') || skill.includes('install-for-openclaw.sh')) good.push('SKILL.md 提供了安装路径');
    else warnings.push('SKILL.md 缺少清晰安装说明');
  }
  if (exists(installOpenClaw)) {
    good.push('存在 install-for-openclaw.sh');
    const audit = checkInstallScript(installOpenClaw);
    good.push(...audit.good);
    warnings.push(...audit.warnings);
  } else warnings.push('缺少 install-for-openclaw.sh（一键技能安装脚本）');

  if (exists(installAlt)) {
    good.push('存在 install-openclaw-flow.sh');
    const audit = checkInstallScript(installAlt);
    good.push(...audit.good);
    warnings.push(...audit.warnings);
  }

  const textFiles = walkTextFiles(dir, 3);
  const hardcodedRootBad = [];
  const hardcodedRootWarn = [];
  const riskyAutoInstall = [];
  const installMismatch = [];
  for (const f of textFiles) {
    const txt = readText(f);
    if (!txt) continue;
    const rel = path.relative(dir, f);
    const base = path.basename(f);
    const historical = base === 'README_PATHS.md' || base === 'project-status-report.md' || txt.includes('historically hard-coded') || txt.includes('historical/demo purposes');
    const installScript = base.startsWith('install') && base.endsWith('.sh');
    if (txt.includes('/root/.openclaw')) {
      if (historical) hardcodedRootWarn.push(rel); else hardcodedRootBad.push(rel);
    }
    if (/npm install .*--no-save/.test(txt) && path.basename(f) === 'cli.js') riskyAutoInstall.push(rel);
    if (txt.includes('install.sh') && !exists(installLegacy) && !installScript) installMismatch.push(rel);
  }

  if (hardcodedRootBad.length) bad.push(`检测到 /root/.openclaw 硬编码: ${hardcodedRootBad.slice(0, 8).join(', ')}`);
  else good.push('未发现代码级 /root/.openclaw 硬编码');
  if (hardcodedRootWarn.length) warnings.push(`存在历史说明类 /root/.openclaw 文档: ${hardcodedRootWarn.slice(0, 8).join(', ')}`);
  if (riskyAutoInstall.length) bad.push(`检测到 CLI 自动 npm install 风险: ${riskyAutoInstall.slice(0, 8).join(', ')}`);
  if (installMismatch.length) warnings.push(`部分文档/脚本仍提到 install.sh: ${installMismatch.slice(0, 8).join(', ')}`);

  let score = 100;
  score -= bad.length * 16;
  score -= warnings.length * 4;
  if (score < 0) score = 0;

  return makeSummary('skill', score, good, warnings, bad, {
    target: dir,
    pkgName: pkg?.name || null,
    verdict: verdict(score),
  });
}

function printSkillReport(report) {
  console.log('🩺 Lobster Doctor · skill');
  console.log(`目标目录: ${report.target || '(未提供)'}`);
  if (report.pkgName) console.log(`包名: ${report.pkgName}`);
  console.log(`评分: ${report.score}/100`);
  console.log(`状态: ${report.status}`);
  console.log(`结论: ${report.verdict}`);
  printList('正常项', '✅', report.good);
  printList('提醒项', '⚠️', report.warnings);
  printList('问题项', '❌', report.bad);
  console.log('\n建议动作:');
  if (report.score >= 85) console.log('- 可以继续补 smoke test，然后往一键装方向推');
  else if (report.score >= 65) console.log('- 先修问题项，再考虑宣传“一键安装”');
  else console.log('- 先把结构、脚本、文档、硬编码问题清干净');
}

function runSkill(target, options = {}) {
  const report = collectSkillReport(target);
  if (options.json) return report;
  printSkillReport(report);
  return report;
}

module.exports = { runSkill, collectSkillReport };
