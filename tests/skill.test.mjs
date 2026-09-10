/**
 * Tests for the skill bundle itself.
 *
 *   node --test
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
  for (const leak of ['then implement', 'write a design', 'create a plan', 'first,', 'step 1']) {
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

test('the skill ships only the plan format', () => {
  // The spec document set was removed deliberately; a leftover reference to it
  // means a document the workflow no longer produces, or a rule it no longer has.
  const removed = [
    'references/artifacts.md',
    'assets/templates/proposal.md',
    'assets/templates/spec.md',
    'assets/templates/design.md',
    'assets/templates/tasks.md',
  ];
  for (const path of removed) {
    assert.ok(!existsSync(join(SKILL_DIR, path)), `${path} should have been removed`);
  }
  for (const token of ['config.yaml', 'canonical', 'delta', 'Covers:', 'Archive']) {
    assert.ok(
      !body.includes(token),
      `SKILL.md still mentions "${token}", which belongs to the removed spec format`,
    );
  }
});

test('the templates exist for both documents the workflow produces', () => {
  for (const name of ['design-doc.md', 'implementation-plan.md']) {
    const path = join(SKILL_DIR, 'assets', 'templates', name);
    assert.ok(existsSync(path) && statSync(path).isFile(), `missing template ${name}`);
  }
});

test('the plan template carries every header line the validator checks', () => {
  const template = readFileSync(
    join(SKILL_DIR, 'assets', 'templates', 'implementation-plan.md'),
    'utf8',
  );
  for (const line of ['**Goal:**', '**Architecture:**', '**Tech Stack:**', '**Spec:**']) {
    assert.ok(template.includes(line), `implementation-plan.md is missing ${line}`);
  }
  assert.match(template, /^### Task \d/m, 'the plan template must show a Task heading shape');
  assert.match(template, /Expected:/, 'the plan template must show a verification step');
});

test('the validator is present and executable as a plain script', () => {
  const path = join(SKILL_DIR, 'scripts', 'validate.mjs');
  assert.ok(existsSync(path), 'missing scripts/validate.mjs');
  const source = readFileSync(path, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env node/, 'validator should carry a node shebang');
  // Zero third-party dependencies: only node: builtins and relative imports of
  // this skill's own files. (The logic lives in scripts/lib/validate.mjs so that
  // importing it has no side effects; the CLI runs unconditionally.)
  assert.doesNotMatch(
    source,
    /^import .* from '(?!node:|\.)/m,
    'the validator must stay zero-dependency: node: builtins and relative files only',
  );
  assert.ok(
    existsSync(join(SKILL_DIR, 'scripts', 'lib', 'validate.mjs')),
    'the importable library should live at scripts/lib/validate.mjs',
  );
});

test('the CLI carries no entry-point check', () => {
  // Node resolves symlinks for import.meta.url but not for process.argv[1], so
  // comparing them made the CLI run nothing through a junction and exit 0 — a
  // silent false pass. The check is gone by design; this fails if it returns.
  // Comments are stripped first: the file explains the removed check, and that
  // explanation is the reason the next reader will not put it back.
  const source = readFileSync(join(SKILL_DIR, 'scripts', 'validate.mjs'), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    '',
  );
  for (const forbidden of ['isEntryPoint', 'import.meta', 'argv[1]']) {
    assert.ok(
      !source.includes(forbidden),
      `scripts/validate.mjs uses "${forbidden}" in code; the CLI must run unconditionally`,
    );
  }
});

test('references document exactly the codes the validator emits', () => {
  // The codes live in the library; the CLI only owns the exit code and the
  // reporting.
  const source = readFileSync(join(SKILL_DIR, 'scripts', 'lib', 'validate.mjs'), 'utf8');
  const doc = readFileSync(join(SKILL_DIR, 'references', 'plan-format.md'), 'utf8');

  // Codes reach the reporter through two shapes — `errors.push({ code: 'F121' })`
  // and the `err(where, 'F105', ...)` helper — so match any quoted code literal
  // rather than the `code:` key, which only sees the first shape.
  const emitted = new Set([...source.matchAll(/'([A-Z]\d{3})'/g)].map((m) => m[1]));
  assert.ok(emitted.size >= 12, `expected the full code set, found ${emitted.size}`);

  const undocumented = [...emitted].filter((c) => !doc.includes(c)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `validate.mjs emits codes not documented in references/plan-format.md: ${undocumented.join(', ')}`,
  );

  // The reverse direction: a documented code with no check behind it is a rule
  // the reference promises and the code does not enforce.
  const documented = new Set([...doc.matchAll(/\b([A-Z]\d{3})\b/g)].map((m) => m[1]));
  const unenforced = [...documented].filter((c) => !emitted.has(c)).sort();
  assert.deepEqual(
    unenforced,
    [],
    `references/plan-format.md documents codes the validator never emits: ${unenforced.join(', ')}`,
  );
});
