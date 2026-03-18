function calcStatus({ bad = [], warnings = [] }) {
  if (bad.length) return 'bad';
  if (warnings.length) return 'warn';
  return 'ok';
}

function exitCodeForStatus(status) {
  if (status === 'bad') return 2;
  if (status === 'warn') return 1;
  return 0;
}

function statusRank(status) {
  if (status === 'bad') return 0;
  if (status === 'warn') return 1;
  return 2;
}

function sortItems(items = []) {
  return [...items].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
}

function makeMeta(report) {
  const counts = {
    good: (report.good || []).length,
    warnings: (report.warnings || []).length,
    bad: (report.bad || []).length,
  };
  return {
    status: report.status,
    score: report.score,
    exitCode: exitCodeForStatus(report.status),
    counts,
    totalFindings: counts.warnings + counts.bad,
  };
}

function makeSummary(name, score, good = [], warnings = [], bad = [], extra = {}) {
  const status = calcStatus({ bad, warnings });
  const report = {
    name,
    status,
    score,
    counts: {
      good: good.length,
      warnings: warnings.length,
      bad: bad.length,
    },
    good: sortItems(good),
    warnings: sortItems(warnings),
    bad: sortItems(bad),
    ...extra,
  };
  report.meta = makeMeta(report);
  return report;
}

function printList(title, icon, items) {
  if (!items.length) return;
  console.log(`\n${icon} ${title}:`);
  items.forEach((item) => console.log(`- ${item}`));
}

function finalizeReport(report) {
  const next = {
    ...report,
    good: sortItems(report.good || []),
    warnings: sortItems(report.warnings || []),
    bad: sortItems(report.bad || []),
  };
  next.status = calcStatus({ bad: next.bad, warnings: next.warnings });
  next.counts = {
    good: next.good.length,
    warnings: next.warnings.length,
    bad: next.bad.length,
  };
  next.meta = makeMeta(next);
  return next;
}

module.exports = {
  calcStatus,
  exitCodeForStatus,
  statusRank,
  sortItems,
  makeMeta,
  makeSummary,
  printList,
  finalizeReport,
};
