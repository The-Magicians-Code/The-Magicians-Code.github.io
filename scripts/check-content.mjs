#!/usr/bin/env node
// Walks src/content/projects/*.md and warns when a case-study section
// (## H2) is missing its leading blockquote (the TL;DR). Warnings only —
// missing summaries don't block the build. See
// docs/superpowers/specs/2026-05-19-case-study-dual-mode-design.md.

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PROJECTS_DIR = join(ROOT, 'src', 'content', 'projects');

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---\n', 4);
  return end === -1 ? text : text.slice(end + 5);
}

function checkBody(body) {
  // Split on lines, walk linearly. For each `## ` heading, peek forward
  // skipping blank lines and confirm the next non-blank line starts with
  // `> ` (a blockquote). Anything else → missing TL;DR.
  const lines = body.split('\n');
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('## ')) continue;
    const heading = line.slice(3).trim();
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length || !lines[j].startsWith('> ')) {
      warnings.push(heading);
    }
  }
  return warnings;
}

let total = 0;
for (const file of readdirSync(PROJECTS_DIR)) {
  if (!file.endsWith('.md')) continue;
  const full = join(PROJECTS_DIR, file);
  const text = readFileSync(full, 'utf8');
  const body = stripFrontmatter(text);
  const warnings = checkBody(body);
  if (warnings.length === 0) continue;
  console.warn(`⚠  ${basename(file)} — sections missing a leading blockquote (TL;DR):`);
  for (const h of warnings) console.warn(`     - "${h}"`);
  total += warnings.length;
}

if (total === 0) {
  console.log('✓  content-check: all project sections have a leading blockquote.');
} else {
  console.warn(`\n  ${total} section(s) flagged. Warnings only — build is not blocked.`);
}
process.exit(0);
