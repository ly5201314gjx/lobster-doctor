#!/usr/bin/env node
if (process.argv.includes('--help') || process.argv.includes('--version')) {
  console.log('min-skill ok');
  process.exit(0);
}
console.log('min-skill run');
