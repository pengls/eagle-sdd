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
