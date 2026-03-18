#!/usr/bin/env node

const { parseCliArgs } = require('../src/core/cli');
const { exitCodeForStatus } = require('../src/core/report');
const { runAll } = require('../src/commands/all');
const { runConfig } = require('../src/commands/config');
const { runSkill } = require('../src/commands/skill');
const { runDisk } = require('../src/commands/disk');
const { runTask } = require('../src/commands/task');

const parsed = parseCliArgs(process.argv.slice(2));
const args = parsed.positionals;
const flags = parsed.flags;
const cmd = args[0];

function help() {
  console.log(`Lobster Doctor\n\n用法:\n  lobster-doctor all [repo-or-dir] [--json] [--baseline file] [--only-new] [--write-baseline file] [--summary-only] [--quiet] [--markdown file]\n  lobster-doctor config [--json]\n  lobster-doctor skill <repo-or-dir> [--json]\n  lobster-doctor disk [--json]\n  lobster-doctor task [--json]\n`);
}

function finish(report) {
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode ?? exitCodeForStatus(report.status);
  }
}

switch (cmd) {
  case 'all': {
    const report = runAll(args[1], {
      json: flags.json,
      baseline: flags.baseline,
      onlyNew: flags.onlyNew,
      writeBaseline: flags.writeBaseline,
      summaryOnly: flags.summaryOnly,
      quiet: flags.quiet,
      markdown: flags.markdown,
    });
    finish(report);
    break;
  }
  case 'config': {
    const report = runConfig({ json: flags.json });
    finish(report);
    break;
  }
  case 'skill': {
    const report = runSkill(args[1], { json: flags.json });
    finish(report);
    break;
  }
  case 'disk': {
    const report = runDisk({ json: flags.json });
    finish(report);
    break;
  }
  case 'task': {
    const report = runTask({ json: flags.json });
    finish(report);
    break;
  }
  default:
    help();
    break;
}
