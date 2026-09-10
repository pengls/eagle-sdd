# Artifact grammar

The exact shapes `scripts/validate.mjs` accepts. Copy from `assets/templates/` rather than reconstructing these by hand.

## Contents

- [Layout](#layout)
- [proposal.md](#proposalmd)
- [Delta specs](#delta-specs)
- [Canonical specs](#canonical-specs)
- [tasks.md](#tasksmd)
- [The archive merge](#the-archive-merge)
- [Validation errors](#validation-errors)

## Layout

```
docs/eagle-sdd/
├── specs/<capability>/spec.md          # canonical truth
└── plans/
    ├── <change-id>/
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/<capability>/spec.md  # deltas
    └── archive/<change-id>/
```

`<capability>` is a path relative to `docs/eagle-sdd/specs/`. It may be one segment (`session-expiry`) or nested to express a domain (`identity/user-auth`). Every segment is kebab-case. The path of a modified capability is copied exactly from the canonical tree — a mistyped path silently targets a capability that does not exist, which is why the validator checks it.

`<change-id>` is kebab-case and act-shaped: `add-session-expiry`, not `sessions`.

## proposal.md

One to two pages. Answers *why* and *what*. Implementation detail belongs in `design.md`.

```markdown
---
change: add-session-expiry
skip_specs: false
---

## Why

Users stay signed in indefinitely on shared machines. Compliance requires a 30-minute idle timeout.

## What Changes

- Sessions expire after 30 minutes of inactivity.
- **BREAKING** The `/auth/refresh` endpoint now rejects expired sessions instead of reviving them.

## Capabilities

### New Capabilities

- `session-expiry`

### Modified Capabilities

- `identity/user-auth`

## Impact

Affects the session middleware, the `/auth/refresh` handler, and the mobile client's silent-refresh path.
```

**Frontmatter**

| Key | Required | Meaning |
|---|---|---|
| `change` | yes | Must equal the plan directory name. |
| `skip_specs` | no, defaults `false` | Set `true` only when no observable behavior changes — pure refactor, tooling, docs, test-only work. |

**Capabilities** is the contract between this artifact and the deltas. Every path listed here must have a matching delta file, and every delta file must be listed here. A change with no capabilities is valid **only** when `skip_specs: true`; otherwise the validator rejects it, because a change that alters behavior without altering a spec is exactly the drift this workflow exists to prevent.

Do not invent a trivial requirement to satisfy the validator. If no behavior changes, set `skip_specs: true` and say so in *What Changes*.

## Delta specs

A delta holds only what this change alters. It never restates the whole spec.

```markdown
## Purpose

Sessions end on their own so a shared machine cannot be left authenticated.

## ADDED Requirements

### Requirement: Session timeout
Sessions SHALL expire 30 minutes after their last authenticated request.

#### Scenario: Idle session expires
- **WHEN** a session is idle for 30 minutes
- **THEN** the next request is rejected with 401
- **AND** the client is redirected to sign-in

#### Scenario: Activity extends the session
- **WHEN** a session is used at minute 29
- **THEN** the expiry window restarts

## MODIFIED Requirements

### Requirement: Token refresh
The system SHALL reject refresh requests whose session has expired.

#### Scenario: Refresh after expiry
- **WHEN** an expired session calls `/auth/refresh`
- **THEN** the response is 401

#### Scenario: Refresh while active
- **WHEN** an active session calls `/auth/refresh`
- **THEN** a new token is issued

## REMOVED Requirements

### Requirement: Indefinite sessions
**Reason**: Superseded by session timeout; also a compliance finding.
**Migration**: Clients must handle 401 by re-authenticating.

## RENAMED Requirements

- `Session lifetime` → `Session timeout`
```

**Section headers.** Exactly four are legal, and each appears at most once per file:

| Header | Holds |
|---|---|
| `## ADDED Requirements` | Requirements that did not exist |
| `## MODIFIED Requirements` | Requirements whose observable behavior changes — restated **in full** |
| `## REMOVED Requirements` | Requirements going away, each with **Reason** and **Migration** |
| `## RENAMED Requirements` | Name changes only. `- \`Old name\` → \`New name\`` |

**Requirement header.** `### Requirement: <name>` — exactly three hashes. The name is the join key that tasks reference, so it must match exactly, modulo collapsed whitespace and case.

**Scenario header.** `#### Scenario: <name>` — exactly four hashes. Three hashes produces a header the validator does not recognize, and the requirement then fails as having no scenarios. Use `- **WHEN** …`, `- **THEN** …`, and `- **AND** …` bullets.

**`## Purpose`** is required for a delta against a capability that does not exist yet, and must run at least 50 characters. Archive copies it into the new canonical spec. Do not add it to a delta for an existing capability — that spec already has one, and the delta's would be ignored. To change an existing capability's Purpose, edit the canonical spec directly.

**Normative language.** Requirements use SHALL or MUST. `should`, `may`, `can`, and `prefer` describe nothing testable and are rejected.

**The full-restatement rule.** A `MODIFIED` requirement must carry the complete new text plus every scenario that survives. The validator compares the scenario set against the canonical spec and errors if you dropped one. If you are adding a scenario without changing existing behavior, that is `ADDED`. Getting this wrong does not fail loudly at the time — it deletes content at archive, which is why the check exists.

## Canonical specs

Written only by [Archive](#the-archive-merge), and by hand when correcting a Purpose.

```markdown
# Session Expiry Specification

## Purpose

Sessions end on their own so a shared machine cannot be left authenticated.

## Requirements

### Requirement: Session timeout
Sessions SHALL expire 30 minutes after their last authenticated request.

#### Scenario: Idle session expires
- **WHEN** a session is idle for 30 minutes
- **THEN** the next request is rejected with 401
```

A canonical spec never contains a delta section header. `## ADDED Requirements` inside `specs/` means someone wrote a change directly into the truth; the validator rejects it.

## tasks.md

```markdown
## 1. Foundation

- [ ] 1.1 Add `expires_at` to the session record and migrate
      Covers: Session timeout
      Depends: none
      Verify: `pnpm test session-store` passes and the migration round-trips

- [ ] 1.2 Add the idle-window helper
      Covers: Session timeout
      Depends: 1.1
      Verify: `pnpm test idle-window` passes

## 2. Enforcement

- [ ] 2.1 Reject expired sessions in the auth middleware
      Covers: Session timeout, Token refresh
      Depends: 1.2
      Verify: `pnpm test auth-middleware` passes with the new expiry case

- [ ] 2.2 Reject refresh for expired sessions
      Covers: Token refresh
      Depends: 2.1
      Verify: `pnpm test auth-refresh` passes
```

**Task ids** are `<group>.<n>` under a `## <group>. <name>` heading. Groups are ordered by dependency.

**The three tags** are continuation lines indented four or more spaces. All three are mandatory.

| Tag | Rule |
|---|---|
| `Covers:` | One or more requirement names, comma-separated, or `none` for a `skip_specs` change. Each name must resolve to a requirement in this change's deltas or the canonical specs. |
| `Depends:` | Comma-separated task ids, or `none`. Each must resolve. The graph must be acyclic. |
| `Verify:` | The command or observation that settles the task. |

**Coverage is bidirectional and enforced.** Every task names what it covers, and every requirement must be covered by at least one task. This is the check that OpenSpec does not have: without it, nothing verifies that a proposal's promised capabilities ever became requirements, and nothing verifies that requirements ever became work. The proposal-to-spec pipeline stays a document nobody validates.

`Covers: none` is legal, and it is the honest value for a `skip_specs` change — a pure refactor covers no requirement. It is not an escape hatch: any requirement this change does introduce still fails `T007` if nothing covers it.

**Verification belongs in the task, not in a separate phase.** A task whose completion you cannot observe is not a task; it is a heading. Reserve standalone verification tasks for integration behavior that genuinely spans several tasks.

## The archive merge

Applied in this order, matched by requirement name normalized to lowercase with collapsed whitespace:

**1. RENAMED → 2. REMOVED → 3. MODIFIED → 4. ADDED**

Ordering is load-bearing. Renaming first means the later operations resolve against final names. Removing before adding means a replacement requirement never collides with the requirement it replaces. Applied in this order the merge is idempotent: running it twice produces the same spec, so a retry after a failure cannot corrupt the truth.

After merging:

1. Re-read the written canonical spec. Confirm it contains the merged requirements and nothing else changed.
2. Move `plans/<change-id>/` to `plans/archive/<change-id>/`.
3. Run `node scripts/validate.mjs` across the whole tree.

A new capability's canonical spec is created with the delta's `## Purpose`.

## Validation errors

`node scripts/validate.mjs [root]` defaults to `docs/eagle-sdd`. It exits `1` on any error.

**Proposal**

| Code | Condition |
|---|---|
| `P001` | Plan has no `proposal.md`. |
| `P002` | Frontmatter missing or missing the `change` key. |
| `P003` | `change` does not match the plan directory name. |
| `P004` | No capabilities declared and `skip_specs` is not `true`. |
| `P005` | `skip_specs: true` but the plan contains delta spec files. |
| `P006` | A declared capability path is not kebab-case. |

**Deltas**

| Code | Condition |
|---|---|
| `D001` | Declared capability has no delta file. |
| `D002` | Delta file exists for an undeclared capability. |
| `D003` | Illegal section header, or a legal one repeated. |
| `D004` | Requirement header is not exactly `### Requirement: <name>`. |
| `D005` | Scenario header missing on a requirement, or not exactly `#### Scenario:`. |
| `D006` | Requirement has no scenarios. |
| `D007` | Requirement name duplicated within a section, or across sections in one file. |
| `D008` | Requirement text contains no SHALL or MUST. |
| `D009` | `## Purpose` missing or under 50 characters on a new capability. |
| `D010` | `MODIFIED` target absent from the canonical spec. |
| `D011` | `MODIFIED` drops a scenario the canonical spec still has. |
| `D012` | `REMOVED` target absent, or missing **Reason** or **Migration**. |
| `D013` | `RENAMED` source absent, or target collides with an existing requirement. |

**Canonical**

| Code | Condition |
|---|---|
| `C001` | Canonical spec contains a delta section header. |
| `C002` | Canonical requirement has no scenarios. |

**Tasks**

| Code | Condition |
|---|---|
| `T001` | No `tasks.md`. |
| `T002` | A list item is not a checkbox. |
| `T003` | Task missing `Covers:`, `Depends:`, or `Verify:`. |
| `T004` | `Covers:` names a requirement that resolves nowhere. |
| `T005` | `Depends:` names a task that does not exist. |
| `T006` | Dependency cycle. |
| `T007` | A requirement in this change is covered by no task. |

Warnings are surfaced but exit `0`.

| Code | Condition |
|---|---|
| `D000` | A delta declares no changes at all. |
| `T000` | `tasks.md` contains no tasks. |
| `T008` | `Covers:` names a canonical requirement that this change does not alter. |
