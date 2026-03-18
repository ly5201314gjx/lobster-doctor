const { statusRank, sortItems } = require('./report');

function printBaselineDiff(name, baseline, options = {}) {
  if (!baseline) return;
  const summaryOnly = !!options.summaryOnly;
  const quiet = !!options.quiet;

  const suppressedBad = sortItems(baseline.suppressedBad || []);
  const suppressedWarnings = sortItems(baseline.suppressedWarnings || []);
  const freshBad = sortItems(baseline.freshBad || []);
  const freshWarnings = sortItems(baseline.freshWarnings || []);

  const totalSuppressed = suppressedBad.length + suppressedWarnings.length;
  const totalFresh = freshBad.length + freshWarnings.length;

  if (!totalSuppressed && !totalFresh) return;

  console.log(`\n🔕 Baseline diff · ${name}`);
  console.log(`- 新增: ${totalFresh} 项`);
  console.log(`- 已抑制: ${totalSuppressed} 项`);

  if (summaryOnly || quiet) return;

  if (freshBad.length) {
    console.log('- 新增 bad:');
    freshBad.forEach((x) => console.log(`  - ${x}`));
  }
  if (freshWarnings.length) {
    console.log('- 新增 warnings:');
    freshWarnings.forEach((x) => console.log(`  - ${x}`));
  }
  if (suppressedBad.length) {
    console.log('- 已抑制 bad:');
    suppressedBad.forEach((x) => console.log(`  - ${x}`));
  }
  if (suppressedWarnings.length) {
    console.log('- 已抑制 warnings:');
    suppressedWarnings.forEach((x) => console.log(`  - ${x}`));
  }
}

function sortedReports(bundle) {
  return Object.entries(bundle.reports || {}).sort((a, b) => {
    const ar = a[1];
    const br = b[1];
    const rankDiff = statusRank(ar.status) - statusRank(br.status);
    if (rankDiff !== 0) return rankDiff;
    return (br.meta?.totalFindings || 0) - (ar.meta?.totalFindings || 0);
  });
}

function toMarkdown(bundle) {
  const lines = [];
  lines.push('# Lobster Doctor Report');
  lines.push('');
  lines.push(`- Status: **${bundle.status}**`);
  lines.push(`- Score: **${bundle.score}/100**`);
  if (bundle.baseline) lines.push(`- Baseline: \`${bundle.baseline}\``);
  if (bundle.onlyNew) lines.push('- Mode: **only-new**');
  lines.push('');
  lines.push('## Summary');
  for (const [name, report] of sortedReports(bundle)) {
    lines.push(`- ${name}: status=${report.status}, score=${report.score}, findings=${report.meta?.totalFindings || 0}`);
  }
  lines.push('');

  for (const [name, report] of sortedReports(bundle)) {
    lines.push(`## ${name}`);
    lines.push(`- Status: **${report.status}**`);
    lines.push(`- Score: **${report.score}/100**`);
    lines.push(`- Exit code: **${report.meta?.exitCode ?? 0}**`);
    lines.push(`- Counts: good=${report.counts?.good || 0}, warnings=${report.counts?.warnings || 0}, bad=${report.counts?.bad || 0}`);
    lines.push('');

    const sections = [
      ['Bad', report.bad || []],
      ['Warnings', report.warnings || []],
      ['Good', report.good || []],
    ];

    for (const [label, items] of sections) {
      if (!items.length) continue;
      lines.push(`### ${label}`);
      items.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (report.baseline) {
      lines.push('### Baseline diff');
      lines.push(`- Fresh bad: ${(report.baseline.freshBad || []).length}`);
      lines.push(`- Fresh warnings: ${(report.baseline.freshWarnings || []).length}`);
      lines.push(`- Suppressed bad: ${(report.baseline.suppressedBad || []).length}`);
      lines.push(`- Suppressed warnings: ${(report.baseline.suppressedWarnings || []).length}`);
      lines.push('');
    }
  }

  return lines.join('\n') + '\n';
}

module.exports = { printBaselineDiff, toMarkdown, sortedReports };
