/**
 * Tests for the skill bundle itself.
 *
 *   node --test tests/
 *
 * These guard the properties that decide whether the skill loads at all:
 * frontmatter validity, the Agent Skills field budget, the invocation policy
 * that keeps it manual-only, and whether every file it points at exists.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = join(REPO, 'skills', 'eagle-sdd');
const SKILL_MD = join(SKILL_DIR, 'SKILL.md');

const raw = readFileSync(SKILL_MD, 'utf8');
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
const frontmatter = match ? match[1] : '';
const body = match ? raw.slice(match[0].length) : raw;

/** Top-level `key: value` lines, ignoring indented continuation. */
const topLevel = Object.fromEntries(
  frontmatter
    .split(/\r?\n/)
    .map((l) => /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const AGENT_SKILLS_FIELDS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
];

test('SKILL.md opens with YAML frontmatter', () => {
  assert.ok(match, 'SKILL.md must start with a --- delimited frontmatter block');
  assert.ok(body.trim().length > 0, 'SKILL.md must have a body after the frontmatter');
});

test('name is present, kebab-case, and matches the directory', () => {
  const name = topLevel.name;
  assert.ok(name, 'frontmatter must set name');
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'name must be lowercase kebab-case');
  assert.ok(name.length <= 64, `name must be at most 64 characters, got ${name.length}`);
  assert.equal(
    name,
    basename(SKILL_DIR),
    'Agent Skills requires the frontmatter name to match the skill directory',
  );
});

test('description is present and within the 1024-character budget', () => {
  const description = topLevel.description;
  assert.ok(description, 'frontmatter must set description');
  assert.ok(description.length <= 1024, `description is ${description.length} characters`);
});

test('description states triggering conditions, not the workflow', () => {
  // Superpowers measured this: a description that summarises the workflow
  // becomes a shortcut the agent follows INSTEAD of reading the body.
  const description = topLevel.description.toLowerCase();
  for (const leak of ['then implement', 'create a proposal', 'write a spec,', 'first,', 'step 1']) {
    assert.ok(
      !description.includes(leak),
      `description leaks workflow detail ("${leak}"); state when to use, not what it does`,
    );
  }
  assert.ok(
    /explicit|by name|only when/.test(description),
    'description must mark this skill as explicitly invoked',
  );
});

test('stay inside the portable Agent Skills field budget', () => {
  const keys = Object.keys(topLevel);
  const extra = keys.filter((k) => !AGENT_SKILLS_FIELDS.includes(k));
  // `disable-model-invocation` is the one deliberate addition. Claude Code and
  // DeepSeek Harness both honour it; Codex ignores it and reads the sidecar.
  assert.deepEqual(
    extra,
    ['disable-model-invocation'],
    `unexpected frontmatter fields: ${extra.join(', ')}`,
  );
});

test('invocation is manual-only', () => {
  assert.equal(
    topLevel['disable-model-invocation'],
    'true',
    'Claude Code and DeepSeek Harness need disable-model-invocation: true',
  );

  const sidecar = join(SKILL_DIR, 'agents', 'openai.yaml');
  assert.ok(existsSync(sidecar), 'Codex reads invocation policy from agents/openai.yaml');
  const yaml = readFileSync(sidecar, 'utf8');
  assert.match(
    yaml,
    /allow_implicit_invocation:\s*false/,
    'Codex sidecar must disable implicit invocation',
  );
});

test('body stays inside the progressive-disclosure budget', () => {
  const lines = body.split(/\r?\n/).length;
  assert.ok(lines < 500, `SKILL.md body is ${lines} lines; keep it under 500`);
});

test('every file SKILL.md points at exists', () => {
  const referenced = new Set(
    [...body.matchAll(/(?:references|assets|scripts)\/[A-Za-z0-9._/-]+/g)].map((m) =>
      m[0].replace(/[.,)]+$/, ''),
    ),
  );
  assert.ok(referenced.size > 0, 'expected SKILL.md to reference supporting files');
  const missing = [...referenced].filter((p) => !existsSync(join(SKILL_DIR, p)));
  assert.deepEqual(missing, [], `SKILL.md references missing files: ${missing.join(', ')}`);
});

test('the templates exist for every artifact the workflow produces', () => {
  for (const name of ['proposal.md', 'spec.md', 'design.md', 'tasks.md']) {
    const path = join(SKILL_DIR, 'assets', 'templates', name);
    assert.ok(existsSync(path) && statSync(path).isFile(), `missing template ${name}`);
  }
});

test('the validator is present and executable as a plain script', () => {
  const path = join(SKILL_DIR, 'scripts', 'validate.mjs');
  assert.ok(existsSync(path), 'missing scripts/validate.mjs');
  const source = readFileSync(path, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env node/, 'validator should carry a node shebang');
  assert.doesNotMatch(
    source,
    /^import .* from '(?!node:)/m,
    'validator must stay zero-dependency: only node: builtins may be imported',
  );
});

test('references document exactly the codes the validator emits', () => {
  const source = readFileSync(join(SKILL_DIR, 'scripts', 'validate.mjs'), 'utf8');
  const doc = readFileSync(join(SKILL_DIR, 'references', 'artifacts.md'), 'utf8');

  // Codes reach the reporter through two shapes — `errors.push({ code: 'D006' })`
  // and the `err(where, 'D001', ...)` helper — so match any quoted code literal
  // rather than the `code:` key, which only sees the first shape.
  const emitted = new Set([...source.matchAll(/'([A-Z]\d{3})'/g)].map((m) => m[1]));
  assert.ok(emitted.size >= 30, `expected the full code set, found ${emitted.size}`);

  const undocumented = [...emitted].filter((c) => !doc.includes(c)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `validate.mjs emits codes not documented in references/artifacts.md: ${undocumented.join(', ')}`,
  );

  // The reverse direction: a documented code with no check behind it is a rule
  // the reference promises and the code does not enforce.
  const documented = new Set([...doc.matchAll(/\b([A-Z]\d{3})\b/g)].map((m) => m[1]));
  const unenforced = [...documented].filter((c) => !emitted.has(c)).sort();
  assert.deepEqual(
    unenforced,
    [],
    `references/artifacts.md documents codes the validator never emits: ${unenforced.join(', ')}`,
  );
});
