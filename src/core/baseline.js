const fs = require('fs');

function loadBaseline(file) {
  if (!file) return { version: 1, items: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      version: raw.version || 1,
      items: raw.items || {},
    };
  } catch {
    return { version: 1, items: {} };
  }
}

function reportToBaselineShape(report) {
  return {
    bad: [...new Set(report.bad || [])],
    warnings: [...new Set(report.warnings || [])],
  };
}

function applyBaselineToReport(report, baseline, onlyNew = false) {
  const known = baseline?.items?.[report.name] || { bad: [], warnings: [] };
  const knownBad = new Set(known.bad || []);
  const knownWarnings = new Set(known.warnings || []);

  const suppressedBad = (report.bad || []).filter((x) => knownBad.has(x));
  const suppressedWarnings = (report.warnings || []).filter((x) => knownWarnings.has(x));
  const freshBad = (report.bad || []).filter((x) => !knownBad.has(x));
  const freshWarnings = (report.warnings || []).filter((x) => !knownWarnings.has(x));

  const next = {
    ...report,
    baseline: {
      suppressedBad,
      suppressedWarnings,
      freshBad,
      freshWarnings,
    },
  };

  if (onlyNew) {
    next.bad = freshBad;
    next.warnings = freshWarnings;
    next.counts = {
      ...next.counts,
      warnings: freshWarnings.length,
      bad: freshBad.length,
    };
    next.status = freshBad.length ? 'bad' : freshWarnings.length ? 'warn' : 'ok';
  }

  return next;
}

function bundleToBaseline(bundle) {
  const items = {};
  for (const [name, report] of Object.entries(bundle.reports || {})) {
    items[name] = reportToBaselineShape(report);
  }
  return { version: 1, items };
}

function saveBaseline(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

module.exports = {
  loadBaseline,
  reportToBaselineShape,
  applyBaselineToReport,
  bundleToBaseline,
  saveBaseline,
};
