function parseCliArgs(argv) {
  const out = {
    positionals: [],
    flags: {
      json: false,
      onlyNew: false,
      baseline: null,
      writeBaseline: null,
      summaryOnly: false,
      quiet: false,
      markdown: null,
    },
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.flags.json = true;
    else if (arg === '--only-new') out.flags.onlyNew = true;
    else if (arg === '--summary-only') out.flags.summaryOnly = true;
    else if (arg === '--quiet') out.flags.quiet = true;
    else if (arg === '--baseline') out.flags.baseline = argv[++i] || null;
    else if (arg === '--write-baseline') out.flags.writeBaseline = argv[++i] || null;
    else if (arg === '--markdown') out.flags.markdown = argv[++i] || null;
    else out.positionals.push(arg);
  }

  return out;
}

module.exports = { parseCliArgs };
