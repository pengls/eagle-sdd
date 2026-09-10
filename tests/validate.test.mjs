/**
 * Tests for the eagle-sdd validator.
 *
 *   node --test
 *
 * Every code documented in references/plan-format.md has a case here that must
 * trigger it. A check that never fires is not a check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../skills/eagle-sdd/scripts/lib/validate.mjs';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'eagle-sdd');

// --------------------------------------------------------------- fixtures

const DESIGN_DOC = `# Store search layout Design

Date: 2026-08-04
Module: Store management page (\`/biz/store\`)
Project: hl-assistant-admin

## 1. Requirement summary

Replace the cramped single-row filter bar with a common-filters row plus a collapsible
more-filters area, so the page stays readable at any width.

## 2. Confirmed decisions

| Question | Decision |
|---|---|
| Layout direction | Option B, beating a multi-row grid and a grouped panel |

## 3. Current state and problem

Eleven filters and four buttons share one row.

## 4. Detailed design

### 4.1 Card header

## 5. Out of scope

## 6. How to verify
`;

const PLAN_DOC = `# Store search layout Implementation Plan

> **For agentic workers:** implement this plan task by task.

**Goal:** the filter bar is readable at any width.
**Architecture:** front-end only, two files.
**Tech Stack:** FreeMarker / jQuery.
**Spec:** \`docs/eagle-sdd/designs/2026-08-04-store-search-layout-design.md\`

## File structure

| File | Change | Responsibility |
|---|---|---|
| \`store.ftl\` | Modify | Search bar layout |

### Task 1: Add the search bar CSS

**Files:**
- Modify: \`store.ftl\`

- [ ] **Step 1: Append the CSS**

- [ ] **Step 2: Verify**

Run: \`rg -n "search-actions" store.ftl\`
Expected: at least four matching lines

- [ ] **Step 3: Commit**

\`\`\`bash
git add store.ftl && git commit -m "style: search bar"
\`\`\`
`;

const BASE = {
  'designs/2026-08-04-store-search-layout-design.md': DESIGN_DOC,
  'plans/2026-08-04-store-search-layout.md': PLAN_DOC,
};

/**
 * The fixture lives at <tmp>/docs/eagle-sdd so the documents'
 * repository-relative `**Spec:**` paths resolve the way they do in a real repo.
 */
function run(mutate = (files) => files) {
  const base = mkdtempSync(join(tmpdir(), 'sdd-plan-'));
  const root = join(base, 'docs', 'eagle-sdd');
  try {
    const files = mutate(structuredClone(BASE));
    mkdirSync(root, { recursive: true });
    for (const [relPath, content] of Object.entries(files)) {
      if (content === null || content === undefined) continue;
      const full = join(root, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    return validate(root);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const codesOf = (result) => [...result.errors, ...result.warnings].map((e) => e.code);

const messagesOf = (result) =>
  [...result.errors, ...result.warnings].map((e) => `${e.code} ${e.msg}`).join('\n  ');

function expectCode(result, code) {
  assert.ok(
    codesOf(result).includes(code),
    `expected ${code}, got: ${codesOf(result).join(', ') || '(none)'}\n  ${messagesOf(result)}`,
  );
}

function expectClean(result) {
  assert.deepEqual(
    result.errors.map((e) => `${e.code} ${e.msg}`),
    [],
    `expected no errors, got:\n  ${messagesOf(result)}`,
  );
}

// ------------------------------------------------------------- happy paths

test('a well-formed pair validates clean', () => {
  expectClean(run());
  assert.deepEqual(codesOf(run()), [], 'a complete pair should report nothing at all');
});

test('HTML comments are guidance, not content', () => {
  const result = run((f) => {
    f['plans/2026-08-04-store-search-layout.md'] = `<!--
### Task 9: A commented-out example task
      Covers: a requirement that does not exist
-->

${PLAN_DOC}`;
    return f;
  });
  expectClean(result);
  assert.ok(!codesOf(result).includes('F110'), 'a commented task must not be parsed');
});

test('task headings work at ## as well as ###', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace('### Task 1:', '## Task 1:');
    return f;
  });
  expectClean(result);
});

test('a trailing section is not absorbed into the last task', () => {
  // The last task has no Expected:; the section after it must not be scanned
  // as part of that task's body.
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = `${f[key]}
## Known risks

Expected: this line belongs to the section, not to Task 1
`;
    return f;
  });
  expectClean(result);
});

// ------------------------------------------------------------------- F000

test('F000 — no documents under the root', () => {
  const result = run((f) => {
    delete f['designs/2026-08-04-store-search-layout-design.md'];
    delete f['plans/2026-08-04-store-search-layout.md'];
    return f;
  });
  expectCode(result, 'F000');
});

test('F000 — the root does not exist at all', () => {
  const result = validate(join(tmpdir(), 'sdd-does-not-exist-9f3a2b'));
  expectCode(result, 'F000');
});

// ---------------------------------------------------------------- filenames

test('F101 — design filename is not <date>-<slug>-design.md', () => {
  const result = run((f) => {
    f['designs/store-search-layout-design.md'] = f['designs/2026-08-04-store-search-layout-design.md'];
    delete f['designs/2026-08-04-store-search-layout-design.md'];
    return f;
  });
  expectCode(result, 'F101');
});

test('F101 — plan filename is not <date>-<slug>.md', () => {
  const result = run((f) => {
    f['plans/store-search-layout.md'] = f['plans/2026-08-04-store-search-layout.md'];
    delete f['plans/2026-08-04-store-search-layout.md'];
    return f;
  });
  expectCode(result, 'F101');
});

// --------------------------------------------------------- plan documents

test('F105 — plan document has no H1 title', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^# .*$\n/m, '');
    return f;
  });
  expectCode(result, 'F105');
});

test('F106 — plan document is missing **Goal:**', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Goal:\*\*.*$\n/m, '');
    return f;
  });
  expectCode(result, 'F106');
});

test('F107 — warns when **Spec:** is absent', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Spec:\*\*.*$\n/m, '');
    return f;
  });
  expectCode(result, 'F107');
  expectClean(result); // a warning, not an error
});

test('F108 — **Spec:** points at a design document that is not there', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(
      'docs/eagle-sdd/designs/2026-08-04-store-search-layout-design.md',
      'docs/eagle-sdd/designs/2026-01-01-does-not-exist-design.md',
    );
    return f;
  });
  expectCode(result, 'F108');
});

test('F109 — plan document has no task heading', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace('### Task 1: Add the search bar CSS', '### Some other section');
    return f;
  });
  expectCode(result, 'F109');
});

test('F110 — a task has no checkbox step', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    // Every step in the task loses its box; one remaining checkbox would satisfy
    // the rule, so replace them all.
    f[key] = f[key].replace(/^- \[ \] /gm, '');
    return f;
  });
  expectCode(result, 'F110');
});

test('F111 — warns when a task states no Expected: or Verify:', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace('Expected: at least four matching lines', 'Looks right.');
    return f;
  });
  expectCode(result, 'F111');
  expectClean(result); // a warning, not an error
});

test('F112 — warns when **Architecture:** is absent', () => {
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Architecture:\*\*.*$\n/m, '');
    return f;
  });
  expectCode(result, 'F112');
});

// ----------------------------------------------------- design documents

test('F121 — design document has no H1 title', () => {
  const result = run((f) => {
    const key = 'designs/2026-08-04-store-search-layout-design.md';
    f[key] = f[key].replace(/^# .*$\n/m, '');
    return f;
  });
  expectCode(result, 'F121');
});

test('F122 — design document has fewer than three sections', () => {
  const result = run((f) => {
    f['designs/2026-08-04-store-search-layout-design.md'] = `# Thin Design

Date: 2026-08-04

## 1. Requirement summary

Too thin to be a design.
`;
    return f;
  });
  expectCode(result, 'F122');
});

// ------------------------------------------------------------- the pair

test('F130 — warns about a design document with no plan of the same slug', () => {
  const result = run((f) => {
    f['designs/2026-08-05-orphan-design.md'] = DESIGN_DOC.replace(
      '# Store search layout Design',
      '# Orphan Design',
    );
    return f;
  });
  expectCode(result, 'F130');
  expectClean(result); // a warning
});

test('the pair is joined on the slug, not on the Spec link', () => {
  // A plan with no **Spec:** line is still recognised as this design's pair,
  // so the design is not reported as an orphan.
  const result = run((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Spec:\*\*.*$\n/m, '');
    return f;
  });
  assert.ok(!codesOf(result).includes('F130'), 'the design should not be an orphan');
});

// --------------------------------------------------------------- the CLI

test('the CLI reports correctly when run through a symlinked install path', () => {
  // The skill is normally installed as a junction into a harness's skill root.
  // Node resolves symlinks when it sets import.meta.url, but leaves
  // process.argv[1] exactly as the caller typed it — so the entry-point check
  // this script used to carry compared unequal, ran nothing, and exited 0. On a
  // broken tree that is a silent false pass, which is worse than any error it
  // could have printed. This test fails if that check ever comes back.
  const base = mkdtempSync(join(tmpdir(), 'sdd-cli-'));
  const linked = join(base, 'linked-skill');
  const root = join(base, 'docs', 'eagle-sdd');
  const plansDir = join(root, 'plans');
  const designsDir = join(root, 'designs');
  const planFile = join(plansDir, '2026-08-04-store-search-layout.md');

  try {
    symlinkSync(SKILL_DIR, linked, process.platform === 'win32' ? 'junction' : 'dir');
    mkdirSync(plansDir, { recursive: true });
    mkdirSync(designsDir, { recursive: true });
    writeFileSync(join(designsDir, '2026-08-04-store-search-layout-design.md'), DESIGN_DOC, 'utf8');
    writeFileSync(planFile, PLAN_DOC, 'utf8');

    // cwd is the fake repository root, so the documents' repository-relative
    // **Spec:** path resolves the way it would in a real one.
    const cli = join(linked, 'scripts', 'validate.mjs');
    const invoke = () =>
      spawnSync(process.execPath, [cli, join('docs', 'eagle-sdd')], {
        cwd: base,
        encoding: 'utf8',
      });

    const clean = invoke();
    assert.notEqual(
      clean.stdout.trim(),
      '',
      'the CLI printed nothing — it did not run at all, which is the silent false pass',
    );
    assert.match(clean.stdout, /OK/, 'a clean tree must report OK through the symlink');
    assert.equal(clean.status, 0, 'a clean tree must exit 0');

    // A broken tree must fail loudly, not quietly pass.
    writeFileSync(planFile, '# no goal\n\n### Task 1: t\n\n- [ ] Step 1\n', 'utf8');
    const broken = invoke();
    assert.match(broken.stdout, /F10\d/, 'a broken tree must report codes through the symlink');
    assert.equal(broken.status, 1, 'a broken tree must not exit 0 through the symlink');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('the library has no side effects when imported', () => {
  // Anything that runs on import would fire during this test file's own load.
  // The counterpart — that the CLI *always* runs when executed — is covered by
  // the symlink test above.
  assert.equal(typeof validate, 'function');
});
