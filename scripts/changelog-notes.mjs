// Prints the CHANGELOG.md section for a version: the release notes.
//
//   node scripts/changelog-notes.mjs 0.1.0            the "## [0.1.0]" section
//   node scripts/changelog-notes.mjs 0.1.0 --release  the same, and its heading must carry a date
//
// Exits with 1 when the section is missing or empty (or, with --release,
// still says "Unreleased" instead of "## [0.1.0] - 2026-11-20").
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const release = args.includes('--release');
const version = (args.find((a) => !a.startsWith('--')) || '').replace(/^v/, '');
if (!version) {
  console.error('Usage: node scripts/changelog-notes.mjs <version> [--release]');
  process.exit(1);
}

const file = 'CHANGELOG.md';
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^## \\[${escaped}\\]`);
const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.error(`${file} has no "## [${version}]" section. Add one before tagging v${version}.`);
  process.exit(1);
}
if (release && !/^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}\s*$/.test(lines[start])) {
  console.error(`The heading "${lines[start]}" needs the release date: "## [${version}] - YYYY-MM-DD".`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
if (end === -1) end = lines.length;
// Not the link references at the bottom ("[0.1.0]: https://...").
const notes = lines
  .slice(start + 1, end)
  .filter((line) => !/^\[[^\]]+\]: /.test(line))
  .join('\n')
  .trim();
if (!notes) {
  console.error(`The "## [${version}]" section of ${file} is empty.`);
  process.exit(1);
}
console.log(notes);
