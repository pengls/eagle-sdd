/**
 * Tests for the eagle-sdd validator.
 *
 *   node --test tests/
 *
 * Every error code documented in references/artifacts.md has a case here that
 * must trigger it. A check that never fires is not a check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { validate } from '../skills/eagle-sdd/scripts/validate.mjs';

// --------------------------------------------------------------- fixtures

const CANONICAL_SESSION = `# Session Specification

## Purpose

Sessions keep a user signed in across requests without re-authenticating every time.

## Requirements

### Requirement: Token refresh
The system SHALL issue a new access token when an active session calls the refresh endpoint.

#### Scenario: Refresh while active
- **WHEN** an active session calls \`/auth/refresh\`
- **THEN** a new access token is issued

#### Scenario: Refresh with a revoked session
- **WHEN** a revoked session calls \`/auth/refresh\`
- **THEN** the response is 401
`;

const PROPOSAL = `---
change: add-idle-timeout
skip_specs: false
---

## Why

Shared machines stay authenticated forever, which is a compliance finding.

## What Changes

- Sessions expire after 30 minutes of inactivity.

## Capabilities

### New Capabilities

- \`idle-timeout\`

### Modified Capabilities

- \`session\`

## Impact

Session middleware and the mobile client's silent-refresh path.
`;

const DELTA_SESSION = `## MODIFIED Requirements

### Requirement: Token refresh
The system SHALL reject refresh requests when the session has expired.

#### Scenario: Refresh while active
- **WHEN** an active session calls \`/auth/refresh\`
- **THEN** a new access token is issued

#### Scenario: Refresh with a revoked session
- **WHEN** a revoked session calls \`/auth/refresh\`
- **THEN** the response is 401

#### Scenario: Refresh after expiry
- **WHEN** an expired session calls \`/auth/refresh\`
- **THEN** the response is 401
`;

const DELTA_IDLE = `## Purpose

Sessions end on their own so a shared machine cannot be left authenticated.

## ADDED Requirements

### Requirement: Session timeout
Sessions SHALL expire 30 minutes after their last authenticated request.

#### Scenario: Idle session expires
- **WHEN** a session is idle for 30 minutes
- **THEN** the next request is rejected with 401
`;

const TASKS = `## 1. Foundation

- [ ] 1.1 Add the idle-window helper
      Covers: Session timeout
      Depends: none
      Verify: \`pnpm test idle-window\` passes

## 2. Enforcement

- [ ] 2.1 Reject expired sessions in the refresh handler
      Covers: Token refresh
      Depends: 1.1
      Verify: \`pnpm test auth-refresh\` passes
`;

const P = 'plans/add-idle-timeout';

const BASE = {
  'specs/session/spec.md': CANONICAL_SESSION,
  [`${P}/proposal.md`]: PROPOSAL,
  [`${P}/specs/session/spec.md`]: DELTA_SESSION,
  [`${P}/specs/idle-timeout/spec.md`]: DELTA_IDLE,
  [`${P}/tasks.md`]: TASKS,
};

/** Materialize a fixture tree, validate it, and tear it down. */
function run(mutate = (files) => files) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-validate-'));
  try {
    const files = mutate(structuredClone(BASE));
    for (const [relPath, content] of Object.entries(files)) {
      if (content === null || content === undefined) continue;
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    return validate(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const codesOf = (result) =>
  [...result.errors, ...result.warnings].map((e) => e.code);

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

test('a well-formed tree validates clean', () => {
  expectClean(run());
});

test('canonical specs parse outside delta sections (regression)', () => {
  // Canonical specs use `## Requirements` and bare `### Requirement:` headers.
  // An earlier parser treated those as illegal delta syntax.
  const result = run();
  expectClean(result);
  assert.ok(
    !codesOf(result).includes('D003') && !codesOf(result).includes('D004'),
    'canonical section headers must not be reported as delta syntax errors',
  );
});

test('skip_specs with no capabilities validates clean', () => {
  const result = run((files) => {
    files[`${P}/proposal.md`] = `---
change: add-idle-timeout
skip_specs: true
---

## Why

Pure refactor, no observable behavior change.

## What Changes

- Extract the session middleware into its own module.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

None.
`;
    delete files[`${P}/specs/session/spec.md`];
    delete files[`${P}/specs/idle-timeout/spec.md`];
    files[`${P}/tasks.md`] = `## 1. Refactor

- [ ] 1.1 Move the session middleware into its own module
      Covers: none
      Depends: none
      Verify: \`pnpm test auth\` passes unchanged
`;
    return files;
  });
  expectClean(result);
});

test('HTML comments are guidance, not content (regression)', () => {
  const result = run((files) => {
    files[`${P}/tasks.md`] = `<!--
- [ ] 9.9 A commented-out example task
      Covers: A requirement that does not exist
      Depends: 8.8
      Verify: nothing
-->

${TASKS}`;
    return files;
  });
  expectClean(result);
});

// ---------------------------------------------------------------- proposal

test('P001 — no proposal.md', () => {
  expectCode(run((f) => (delete f[`${P}/proposal.md`], f)), 'P001');
});

test('P002 — frontmatter missing the change key', () => {
  const result = run((f) => {
    f[`${P}/proposal.md`] = `## Why\n\nNo frontmatter here.\n`;
    return f;
  });
  expectCode(result, 'P002');
});

test('P003 — change does not match the directory name', () => {
  const result = run((f) => {
    f[`${P}/proposal.md`] = PROPOSAL.replace('change: add-idle-timeout', 'change: something-else');
    return f;
  });
  expectCode(result, 'P003');
});

test('P004 — no capabilities declared and skip_specs is not set', () => {
  const result = run((f) => {
    f[`${P}/proposal.md`] = `---
change: add-idle-timeout
---

## Why

Nothing declared.

## Capabilities

### New Capabilities

### Modified Capabilities
`;
    delete f[`${P}/specs/session/spec.md`];
    delete f[`${P}/specs/idle-timeout/spec.md`];
    return f;
  });
  expectCode(result, 'P004');
});

test('P005 — skip_specs set while capabilities are declared', () => {
  const result = run((f) => {
    f[`${P}/proposal.md`] = PROPOSAL.replace('skip_specs: false', 'skip_specs: true');
    return f;
  });
  expectCode(result, 'P005');
});

test('P006 — capability path is not kebab-case', () => {
  const result = run((f) => {
    f[`${P}/proposal.md`] = PROPOSAL.replace('- `idle-timeout`', '- `Idle_Timeout`');
    delete f[`${P}/specs/idle-timeout/spec.md`];
    return f;
  });
  expectCode(result, 'P006');
});

// ----------------------------------------------------------------- deltas

test('D001 — declared capability has no delta file', () => {
  expectCode(run((f) => (delete f[`${P}/specs/idle-timeout/spec.md`], f)), 'D001');
});

test('D002 — delta exists for an undeclared capability', () => {
  const result = run((f) => {
    f[`${P}/specs/rogue/spec.md`] = `## Purpose

A capability nobody declared, long enough to pass the purpose length check.

## ADDED Requirements

### Requirement: Rogue behavior
The system SHALL misbehave.

#### Scenario: Rogue
- **WHEN** it runs
- **THEN** it misbehaves
`;
    return f;
  });
  expectCode(result, 'D002');
});

test('D003 — illegal section header', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE.replace(
      '## ADDED Requirements',
      '## CHANGED Requirements',
    );
    return f;
  });
  expectCode(result, 'D003');
});

test('D004 — requirement header uses the wrong number of hashes', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE.replace(
      '### Requirement: Session timeout',
      '## Requirement: Session timeout',
    );
    return f;
  });
  expectCode(result, 'D004');
});

test('D005 — scenario header uses three hashes instead of four', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE.replace(
      '#### Scenario: Idle session expires',
      '### Scenario: Idle session expires',
    );
    return f;
  });
  expectCode(result, 'D005');
});

test('D006 — requirement has no scenarios', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = `## Purpose

Sessions end on their own so a shared machine cannot be left authenticated.

## ADDED Requirements

### Requirement: Session timeout
Sessions SHALL expire 30 minutes after their last authenticated request.
`;
    return f;
  });
  expectCode(result, 'D006');
});

test('D007 — duplicate requirement within a section', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE + `
### Requirement: Session timeout
Sessions SHALL expire again.

#### Scenario: Again
- **WHEN** it expires
- **THEN** it stays expired
`;
    return f;
  });
  expectCode(result, 'D007');
});

test('D008 — requirement text uses neither SHALL nor MUST', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE.replace(
      'Sessions SHALL expire 30 minutes after their last authenticated request.',
      'Sessions should probably expire after a while.',
    );
    return f;
  });
  expectCode(result, 'D008');
});

test('D009 — new capability without a substantial Purpose', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE.replace(
      '## Purpose\n\nSessions end on their own so a shared machine cannot be left authenticated.\n\n',
      '## Purpose\n\nTimeouts.\n\n',
    );
    return f;
  });
  expectCode(result, 'D009');
});

test('D010 — MODIFIED target is absent from the canonical spec', () => {
  const result = run((f) => {
    f[`${P}/specs/session/spec.md`] = DELTA_SESSION.replace(
      '### Requirement: Token refresh',
      '### Requirement: Nonexistent requirement',
    );
    return f;
  });
  expectCode(result, 'D010');
});

test('D011 — MODIFIED drops a scenario the canonical spec still has', () => {
  const result = run((f) => {
    f[`${P}/specs/session/spec.md`] = `## MODIFIED Requirements

### Requirement: Token refresh
The system SHALL reject refresh requests when the session has expired.

#### Scenario: Refresh while active
- **WHEN** an active session calls \`/auth/refresh\`
- **THEN** a new access token is issued
`;
    return f;
  });
  expectCode(result, 'D011');
});

test('D012 — REMOVED target is absent from the canonical spec', () => {
  const result = run((f) => {
    f[`${P}/specs/idle-timeout/spec.md`] = DELTA_IDLE + `
## REMOVED Requirements

### Requirement: Nothing like this exists
**Reason**: It never existed.
**Migration**: None needed.
`;
    return f;
  });
  expectCode(result, 'D012');
});

test('D012 — REMOVED entry missing Migration', () => {
  const result = run((f) => {
    f[`${P}/specs/session/spec.md`] = DELTA_SESSION + `
## REMOVED Requirements

### Requirement: Token refresh
**Reason**: Replaced.
`;
    return f;
  });
  expectCode(result, 'D012');
});

test('D013 — RENAMED source is absent from the canonical spec', () => {
  const result = run((f) => {
    f[`${P}/specs/session/spec.md`] = DELTA_SESSION + `
## RENAMED Requirements

- \`No such requirement\` → \`Something new\`
`;
    return f;
  });
  expectCode(result, 'D013');
});

// -------------------------------------------------------------- canonical

test('C001 — canonical spec contains a delta section header', () => {
  const result = run((f) => {
    f['specs/session/spec.md'] = CANONICAL_SESSION + `
## ADDED Requirements

### Requirement: Leaked delta
The system SHALL not have this here.

#### Scenario: Leak
- **WHEN** read
- **THEN** it is wrong
`;
    return f;
  });
  expectCode(result, 'C001');
});

test('C002 — canonical requirement has no scenarios', () => {
  const result = run((f) => {
    f['specs/session/spec.md'] = `# Session Specification

## Purpose

Sessions keep a user signed in across requests without re-authenticating every time.

## Requirements

### Requirement: Orphan
The system SHALL do something with no scenario at all.
`;
    delete f[`${P}/specs/session/spec.md`];
    return f;
  });
  expectCode(result, 'C002');
});

// ------------------------------------------------------------------ tasks

test('T001 — no tasks.md', () => {
  expectCode(run((f) => (delete f[`${P}/tasks.md`], f)), 'T001');
});

test('T002 — a list item that is not a checkbox', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = `${TASKS}\n- 3.1 This one has no checkbox\n`;
    return f;
  });
  expectCode(result, 'T002');
});

test('T003 — task missing a mandatory tag', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = TASKS.replace('      Verify: `pnpm test auth-refresh` passes\n', '');
    return f;
  });
  expectCode(result, 'T003');
});

test('T004 — Covers names a requirement that resolves nowhere', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = TASKS.replace('Covers: Token refresh', 'Covers: A ghost requirement');
    return f;
  });
  expectCode(result, 'T004');
});

test('T005 — Depends names a task that does not exist', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = TASKS.replace('Depends: 1.1', 'Depends: 7.7');
    return f;
  });
  expectCode(result, 'T005');
});

test('T006 — dependency cycle', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = TASKS.replace('Depends: none', 'Depends: 2.1');
    return f;
  });
  expectCode(result, 'T006');
});

test('T007 — a requirement is covered by no task', () => {
  const result = run((f) => {
    f[`${P}/tasks.md`] = `## 1. Foundation

- [ ] 1.1 Only cover one of the two requirements
      Covers: Session timeout
      Depends: none
      Verify: \`pnpm test idle-window\` passes
`;
    return f;
  });
  expectCode(result, 'T007');
});

// --------------------------------------------------------------- warnings

test('T008 — Covers names a canonical requirement this change does not alter', () => {
  const result = run((f) => {
    f['specs/session/spec.md'] = CANONICAL_SESSION + `
### Requirement: Password hashing
The system SHALL hash passwords.

#### Scenario: Hashing
- **WHEN** a password is set
- **THEN** a hash is stored
`;
    f[`${P}/tasks.md`] = TASKS.replace(
      'Covers: Token refresh',
      'Covers: Token refresh, Password hashing',
    );
    return f;
  });
  expectCode(result, 'T008');
  expectClean(result);
});

// ------------------------------------------------------------- plan format

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
`;

const PLAN_BASE = {
  'designs/2026-08-04-store-search-layout-design.md': DESIGN_DOC,
  'plans/2026-08-04-store-search-layout.md': PLAN_DOC,
};

/**
 * The plan-format fixture lives at <tmp>/docs/eagle-sdd so that the documents'
 * repository-relative `**Spec:**` paths resolve the way they do in a real repo.
 */
function runPlan(mutate = (files) => files) {
  const base = mkdtempSync(join(tmpdir(), 'sdd-plan-'));
  const root = join(base, 'docs', 'eagle-sdd');
  try {
    const files = mutate(structuredClone(PLAN_BASE));
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

test('a well-formed plan-format pair validates clean', () => {
  expectClean(runPlan());
});

test('a plan document is free not to carry a Spec link', () => {
  // The pair is joined on the shared <date>-<slug>, so an omitted **Spec:**
  // is not an error — plenty of hand-written plans leave it out.
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Spec:\*\*.*$\n/m, '');
    return f;
  });
  expectClean(result);
});

test('F101 — design filename is not <date>-<slug>-design.md', () => {
  const result = runPlan((f) => {
    f['designs/store-search-layout-design.md'] = f['designs/2026-08-04-store-search-layout-design.md'];
    delete f['designs/2026-08-04-store-search-layout-design.md'];
    return f;
  });
  expectCode(result, 'F101');
});

test('F101 — plan filename is not <date>-<slug>.md', () => {
  const result = runPlan((f) => {
    f['plans/store-search-layout.md'] = f['plans/2026-08-04-store-search-layout.md'];
    delete f['plans/2026-08-04-store-search-layout.md'];
    return f;
  });
  expectCode(result, 'F101');
});

test('F105 — plan document has no H1 title', () => {
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^# .*$\n/m, '');
    return f;
  });
  expectCode(result, 'F105');
});

test('F106 — plan document is missing **Goal:**', () => {
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Goal:\*\*.*$\n/m, '');
    return f;
  });
  expectCode(result, 'F106');
});

test('F108 — **Spec:** points at a design document that is not there', () => {
  const result = runPlan((f) => {
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
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace('### Task 1: Add the search bar CSS', '### Some other section');
    return f;
  });
  expectCode(result, 'F109');
});

test('F110 — a task has no checkbox step', () => {
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/- \[ \] \*\*Step 1[\s\S]*?- \[ \] \*\*Step 2/, '- **Step 1: Append the CSS**\n\n- **Step 2');
    return f;
  });
  expectCode(result, 'F110');
});

test('F111 — warns when a task states no Expected: or Verify:', () => {
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace('Expected: at least four matching lines', 'Looks right.');
    return f;
  });
  expectCode(result, 'F111');
  expectClean(result); // a warning, not an error
});

test('F112 — warns when **Architecture:** is absent', () => {
  const result = runPlan((f) => {
    const key = 'plans/2026-08-04-store-search-layout.md';
    f[key] = f[key].replace(/^\*\*Architecture:\*\*.*$\n/m, '');
    return f;
  });
  expectCode(result, 'F112');
});

test('F121 — design document has no H1 title', () => {
  const result = runPlan((f) => {
    const key = 'designs/2026-08-04-store-search-layout-design.md';
    f[key] = f[key].replace(/^# .*$\n/m, '');
    return f;
  });
  expectCode(result, 'F121');
});

test('F122 — design document has fewer than three sections', () => {
  const result = runPlan((f) => {
    f['designs/2026-08-04-store-search-layout-design.md'] = `# Thin Design

Date: 2026-08-04

## 1. Requirement summary

Too thin to be a design.
`;
    return f;
  });
  expectCode(result, 'F122');
});

test('F130 — warns about a design document with no plan of the same slug', () => {
  const result = runPlan((f) => {
    f['designs/2026-08-05-orphan-design.md'] = DESIGN_DOC.replace(
      '# Store search layout Design',
      '# Orphan Design',
    );
    return f;
  });
  expectCode(result, 'F130');
});

test('F131 — warns when both document sets are present', () => {
  const result = runPlan((f) => {
    // A spec-format change directory alongside the plan-format files.
    f['plans/add-idle-timeout/proposal.md'] = `---\nchange: add-idle-timeout\nskip_specs: true\n---\n\n## Why\n\nx\n`;
    f['plans/add-idle-timeout/tasks.md'] = `## 1. Group\n\n- [ ] 1.1 Do it\n      Covers: none\n      Depends: none\n      Verify: it works\n`;
    return f;
  });
  expectCode(result, 'F131');
});

test('F132 — config.yaml declares a format the documents contradict', () => {
  const result = runPlan((f) => {
    f['config.yaml'] = 'format: spec\n';
    return f;
  });
  expectCode(result, 'F132');
  expectClean(result); // a warning
});

test('the spec-format tree is untouched by the plan-format checks', () => {
  // Neither designs/ nor dated plan files exist here, so nothing extra fires.
  const result = run();
  expectClean(result);
  for (const code of ['F101', 'F105', 'F109', 'F121', 'F122']) {
    assert.ok(!codesOf(result).includes(code), `${code} should not fire on a spec-format tree`);
  }
});
