# Drop the spec document set Design

Date: 2026-09-10
Module: the skill itself (`skills/eagle-sdd/`)
Project: eagle-sdd

## 1. Requirement summary

The skill shipped two document sets: `spec` (canonical specs plus per-change deltas) and `plan`
(a dated design-and-plan pair), chosen once per repository and recorded in a config file. Both
were exercised. The `spec` set is removed, the choice is removed, and `plan` becomes the only
output. Nothing is asked and no configuration file is written.

This pair is the first document the plan format produces in this repository. It is written after
the fact and records work that was already done and verified — a repository adopting a format has
no earlier document to be faithful to, and inventing one would be worse than saying so.

## 2. Confirmed decisions

| Question | Decision |
|---|---|
| Which format survives | `plan` only. The `spec` set is deleted, not hidden behind a flag |
| Is the format still asked for | No. There is nothing to choose, so there is no question and no `config.yaml` |
| What happens to `docs/eagle-sdd/specs/` | Deleted, including the three capability specs. Git history is the record |
| What happens to the archived change plans | Deleted with the rest. They were themselves spec-format artifacts |
| Coverage enforcement (`Covers:` / `Depends:`) | Dropped with the spec set. The plan format has no requirement graph to join against |
| The evidence gate | Kept. It is the skill's core value and does not depend on the document format |
| `**Spec:**` presence | A warning, not an error. Seven of eight real hand-written plans omit it, so the pair is joined on the shared date-and-slug instead |
| Validator codes | Reduced to twelve. The `P`, `D`, `C` and `T` families belonged to the deleted format |

Considered and rejected: keeping `spec` behind an opt-in flag (two formats to maintain for a
choice the user has already made); keeping the capability specs as read-only history (they are a
different format's artifacts, and a tree that the workflow no longer writes is a tree that
rots); inventing a task-to-design-section link to replace `Covers:` (the format's whole point is
that it stays faithful to what hand-run workflows produce).

## 3. Current state and problem

Both sets were implemented and tested: `references/artifacts.md` and four templates for `spec`,
`references/plan-format.md` and two templates for `plan`, a format table and per-step branches in
`SKILL.md`, and 44 validator codes across both.

Three problems:

- **The branch was in the middle of every step.** Steps 3, 4, 5, 6 and 9 each opened with the
  `plan` variant and then a line saying "the rest of this step is `spec` only". A reader who
  missed the switch would do both.
- **The `spec` set carried machinery the user does not want.** A canonical tree, a delta grammar
  with four operations and a fixed merge order, an archive step, and a coverage graph — all of it
  to maintain a single current description of the system, which is the thing the chosen format
  deliberately gives up.
- **The choice itself was a cost.** A question on first run, a config file to write and read, and
  a consistency check between the declared format and the documents on disk.

## 4. Detailed design

### 4.1 The workflow becomes seven steps

Orient, Grill, Design document, Plan document, Implement, Verify, Close. The format table, the
resolution step, and the per-step branches are gone. Two gates survive, both blocking: the user
approves the design before the plan is written, and sees the task list before implementation
starts.

`Close` replaces the old `Archive`: there is nothing to merge, so it confirms the pair, checks
that the plan's `**Spec:**` link still resolves, runs the validator, and reports.

### 4.2 The validator drops to twelve codes

`F000` (no tree), `F101` (filename shape), `F105`/`F106` (plan title and goal), `F107`/`F112`
(warnings for a missing `**Spec:**` or `**Architecture:**`), `F108` (a `**Spec:**` that does not
resolve), `F109`/`F110` (task headings and checkbox steps), `F111` (a task stating no
`Expected:`), and `F121`/`F122`/`F130` (design title, section count, orphan design).

Every check parses one flat document. There is no cross-document requirement resolution left, so
`validate()` reads two directories and never has to load a second file to check the first.

### 4.3 The calibration principle is kept and written down

The `F` checks were loosened twice after being run against sixteen real hand-written documents.
The rule that came out of it — *a check that fails correct work gets disabled, and a disabled
check protects nothing* — is recorded in `references/plan-format.md` next to the warnings it
explains, because it is the reason those codes are warnings rather than errors.

## 5. Out of scope

The install path, the plugin manifests, and the harness mapping are untouched. The evidence gate
in `references/verification.md` is untouched. No attempt is made to migrate the deleted
capability specs into the new format beyond this pair, which records the decision they held.

## 6. How to verify

1. `node --test` — 33 cases, one per surviving code, plus bundle checks.
2. `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd` — this pair validates clean.
3. `node skills/eagle-sdd/scripts/validate.mjs <a tree of real hand-written pairs>` — zero
   errors, only the expected warnings.
4. `grep -r` the skill for `config.yaml`, `Covers:`, `canonical`, `delta` and `Archive` — the
   bundle test asserts none survive in `SKILL.md`.
