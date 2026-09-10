# Drop the spec document set Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Written as the record of a change that was already made and verified; every `Run:` below was executed and its output read.

**Goal:** the skill produces exactly one document set — `designs/<date>-<slug>-design.md` paired with `plans/<date>-<slug>.md` — with no format question, no `config.yaml`, and no canonical or delta machinery anywhere in the code, the references, or the tests.

**Architecture:** a subtraction. `SKILL.md` loses the format table, the resolution step and the per-step branches, and its seven remaining steps stay format-neutral. `references/artifacts.md` and the four `spec` templates are deleted; `references/plan-format.md` becomes *the* format rather than the second one. The validator loses the `P`, `D`, `C` and `T` families and keeps the twelve `F` codes. This repository's own `docs/eagle-sdd/` is converted to the surviving format.

**Tech Stack:** Markdown, zero-dependency Node 18+ ESM, `node:test`.

**Spec:** `docs/eagle-sdd/designs/2026-09-10-drop-spec-format-design.md`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `skills/eagle-sdd/SKILL.md` | Rewrite | Seven steps, two gates, no format branch |
| `skills/eagle-sdd/references/plan-format.md` | Rewrite | The only format's grammar and its twelve checks |
| `skills/eagle-sdd/references/artifacts.md` | Delete | Grammar for the removed spec set |
| `skills/eagle-sdd/assets/templates/{proposal,spec,design,tasks}.md` | Delete | Templates for the removed spec set |
| `skills/eagle-sdd/scripts/validate.mjs` | Rewrite | Twelve codes, two flat directories, no cross-document resolution |
| `tests/validate.test.mjs` | Rewrite | One case per surviving code |
| `tests/skill.test.mjs` | Rewrite | Bundle checks plus an assertion that the spec set is gone |
| `docs/eagle-sdd/` | Convert | This repository's own documents, in the surviving format |
| `README.md` | Rewrite | One format, no choice |
| `docs/WORKFLOW.md` | Add | The full flow, written for a human reader |

---

### Task 1: Reduce the skill to one format

**Files:**
- Rewrite: `skills/eagle-sdd/SKILL.md`
- Delete: `skills/eagle-sdd/references/artifacts.md`
- Delete: `skills/eagle-sdd/assets/templates/proposal.md`, `spec.md`, `design.md`, `tasks.md`

- [x] **Step 1: Rewrite SKILL.md as seven steps**

Orient, Grill, Design document, Plan document, Implement, Verify, Close. Keep the four-rule
contract, the scope-check table, the rationalisation table and the red flags. Remove the format
table, the resolution step and every "the rest of this step is `spec` only" branch. Two gates,
both blocking: the design before the plan, and the task list before implementation.

- [x] **Step 2: Delete the spec-set files**

- [x] **Step 3: Verify no spec-format vocabulary survives in the spine**

Run: `rg -n "config.yaml|canonical|delta|Covers:|Archive" skills/eagle-sdd/SKILL.md`
Expected: no matches

- [x] **Step 4: Verify the body budget**

Run: `node --test tests/skill.test.mjs`
Expected: the progressive-disclosure test passes, so the body is under 500 lines

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd
git commit -m "skill: reduce the workflow to the plan format only"
```

---

### Task 2: Reduce the validator

**Files:**
- Rewrite: `skills/eagle-sdd/scripts/validate.mjs`

- [x] **Step 1: Remove the `P`, `D`, `C` and `T` families**

They all depended on the deleted format: proposals, delta sections, canonical specs, and tasks
with a `Covers:` graph. `validate()` no longer needs to load a second file to check the first.

- [x] **Step 2: Keep twelve `F` codes**

`F000`, `F101`, `F105`, `F106`, `F107`, `F108`, `F109`, `F110`, `F111`, `F112`, `F121`, `F122`,
`F130`. Reinstating `F107` as a warning for a missing `**Spec:**` link, which the earlier version
had removed.

- [x] **Step 3: Verify the file stays dependency-free and parses**

Run: `node --check skills/eagle-sdd/scripts/validate.mjs`
Expected: no output

- [x] **Step 4: Commit**

```bash
git add skills/eagle-sdd/scripts/validate.mjs
git commit -m "validator: drop the spec-format families, keep the twelve plan checks"
```

---

### Task 3: Rewrite the tests around the surviving codes

**Files:**
- Rewrite: `tests/validate.test.mjs`, `tests/skill.test.mjs`

- [x] **Step 1: One case per surviving code, plus the happy path**

Thirty-four spec-format cases go; the plan-format cases stay and gain `F000` and `F107`.

- [x] **Step 2: Assert the spec set is actually gone**

A bundle test asserts the four templates and `references/artifacts.md` no longer exist, and that
`SKILL.md` contains none of the removed vocabulary. Without it, a stale reference survives
silently.

- [x] **Step 3: Verify**

Run: `node --test`
Expected: 33 passing, 0 failing

- [x] **Step 4: Commit**

```bash
git add tests
git commit -m "tests: cover the surviving codes and assert the spec set is gone"
```

---

### Task 4: Convert this repository's own documents

**Files:**
- Delete: `docs/eagle-sdd/specs/`, `docs/eagle-sdd/plans/archive/`, `docs/eagle-sdd/config.yaml`
- Create: `docs/eagle-sdd/designs/2026-09-10-drop-spec-format-design.md`
- Create: `docs/eagle-sdd/plans/2026-09-10-drop-spec-format.md`

- [x] **Step 1: Remove the spec-format tree**

The three capability specs, the two archived change plans and the config file.

- [x] **Step 2: Write this change's pair in the surviving format**

The design records why the format was dropped and what the calibration principle is, so the
deleted capability specs are not simply lost. Note in the design that it is written after the
fact — a repository adopting a format has no earlier document to be faithful to.

- [x] **Step 3: Verify this repository validates clean**

Run: `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd`
Expected: `OK`, no warnings

- [x] **Step 4: Commit**

```bash
git add docs/eagle-sdd
git commit -m "docs: record the format decision as the first plan-format pair"
```

---

### Task 5: Calibrate against real documents again

**Files:**
- No repository change; a fixture built from sixteen hand-written documents

- [x] **Step 1: Run the reduced validator against real pairs**

Build a fixture from eight real plan documents and their eight design documents, then run the
validator over it.

Run: `node skills/eagle-sdd/scripts/validate.mjs <fixture>/docs/eagle-sdd`
Expected: `OK` with 6 warnings and 0 errors

- [x] **Step 2: Confirm no new false positive was introduced**

Any error on those documents means a rule is stricter than what careful humans produce. Loosen
the rule or make it a warning, and say which in `references/plan-format.md`.

---

### Task 6: Document the workflow

**Files:**
- Rewrite: `README.md`
- Add: `docs/WORKFLOW.md`

- [x] **Step 1: Rewrite the README for a single format**

Remove the two-format table, the `plan`-vs-`spec` guidance and the `config.yaml` instructions.
Note that adopting the new version means deleting a `docs/eagle-sdd/specs/` tree and any
`config.yaml` left by the old format.

- [x] **Step 2: Write the full flow for a human reader**

`docs/WORKFLOW.md` walks the seven steps end to end — what each produces, the two gates, the
task shape, the evidence gate, and what happens when a task blocks or turns out to be wrong. It
is a walkthrough, not the contract: `SKILL.md` stays normative.

Run: `rg -n "open the workflow|Design document|Plan document|Implement|Verify|Close" docs/WORKFLOW.md`
Expected: every step is present

- [x] **Step 3: Commit**

```bash
git add README.md docs/WORKFLOW.md
git commit -m "docs: describe the single-format workflow end to end"
```
