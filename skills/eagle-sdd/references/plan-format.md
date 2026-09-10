# The `plan` format

The second document set this skill can produce. Selected in step 1; see
[Choosing a format](#choosing-a-format) below.

Where the `spec` format keeps a canonical spec and records each change as a delta against it,
the `plan` format writes **one dated pair per change** and keeps no canonical tree. Nothing is
merged, nothing accumulates. The design document is the record of what was decided; the plan
document is the record of what was done.

## Contents

- [Layout](#layout)
- [Choosing a format](#choosing-a-format)
- [designs/<date>-<slug>-design.md](#designsdate-slug-designmd)
- [plans/<date>-<slug>.md](#plansdate-slugmd)
- [Checks](#checks)

## Layout

```
docs/eagle-sdd/
├── config.yaml                              # which format this repository uses
├── designs/<YYYY-MM-DD>-<slug>-design.md    # one per change, frozen at its date
└── plans/<YYYY-MM-DD>-<slug>.md             # the implementation plan for that design
```

Both directories are flat. The filename carries the date and the slug, so a change is
identified by `2026-08-04-store-search-layout` rather than by a directory.

`plans/` is shared with the `spec` format, which puts a **directory** per change there instead
of a file. That is why the two cannot be confused mechanically, and why a repository that has
both is worth flagging: the validator warns rather than fails.

## Choosing a format

The skill resolves the format once per repository and records it in `docs/eagle-sdd/config.yaml`:

```yaml
# spec - canonical specs plus per-change deltas (default)
# plan - a dated design document plus a dated implementation plan
format: spec
```

If the file is absent the skill asks, with `spec` as the recommendation, then writes the
answer. A later run that finds the file does not ask again. A run can be overridden by the
user at any time, and the override rewrites the file.

Do not infer the format from the request. A small change is still a `plan` change if that is
what the repository uses.

## designs/&lt;date&gt;-&lt;slug&gt;-design.md

The design document. It replaces both the proposal and the spec of the `spec` format: it
carries the why, the what, and the decisions, in one dated file.

```markdown
# Store search layout Design

Date: 2026-08-04
Module: Store management page (`/biz/store`)
Project: hl-assistant-admin

## 1. Requirement summary
...
## 2. Confirmed decisions

| Question | Decision |
|---|---|
| Layout direction | Option B: common filters on the first row plus a "more filters" collapse (beat a multi-row grid and a grouped panel) |

## 3. Current state and problem
## 4. Detailed design
### 4.1 Card header
## 5. Out of scope
## 6. How to verify
```

**Required:** an `# H1` title, and at least three `##` sections. Section *names* are not
checked — the numbered list above is the convention, not the contract, and the headings may be
translated.

**Write it before the plan.** The plan document points at this one; there is no ordering in
which the plan exists first.

**Frozen at its date.** Nothing rewrites a design document later. A change of mind is a new
dated pair, not an edit. That is the whole difference from the `spec` format, and it is the
trade: you gain a durable record of what was decided on a given day, and you give up a single
current description of the system.

## plans/&lt;date&gt;-&lt;slug&gt;.md

```markdown
# Store search layout Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** <what is true after this plan is executed>
**Architecture:** <the shape of the change>
**Tech Stack:** <what it touches>
**Spec:** `docs/eagle-sdd/designs/2026-08-04-store-search-layout-design.md`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/.../store.ftl` | Modify | Search bar layout, card header buttons |

---

### Task 1: Add the search bar layout CSS

**Files:**
- Modify: `src/.../store.ftl`（the `<style>` block）

- [ ] **Step 1: Append the CSS**
- [ ] **Step 2: Verify**

Run: `rg -n "search-actions" src/.../store.ftl`
Expected: at least four matching lines, no error

- [ ] **Step 3: Commit**
```

**Required header lines.** `**Goal:**` is required. `**Architecture:**` is expected and warned
about when absent. `**Spec:**` is a convenience link: the pair is joined on the shared
`<date>-<slug>`, not on this line, because plenty of real plans omit it — but when it *is*
present it must resolve to a design document that exists. A plan pointing at a design that
is not there is worse than a plan with no link at all.

**One `Task N: <title>` per task**, at any heading level from `##` to `####` — both are in
common use. Every task needs:

- at least one `- [ ]` step, and
- a verification step: a `Run:` line and an `Expected:` line, or `Verify:` with a command.

A task whose completion nobody can observe is a heading, not a task. The `Run:`/`Expected:`
pair is the same discipline as the `spec` format's `Verify:` tag, in the shape this format uses.

**Show the code in the step.** "Update the handler to reject expired sessions" is not a step;
the replacement code is. The plan is executed by someone who was not in the conversation that
produced it — quite often by a fresh agent with no memory of it.

**Commit per task.** The third step of every task. The commit is what makes a task cheap to
undo, and the git history becomes the record of execution the design document cannot hold.

## Checks

`node scripts/validate.mjs` validates whichever documents it finds. The `plan` format adds:

**Design documents**

| Code | Condition |
|---|---|
| `F101` | Filename is not `<YYYY-MM-DD>-<slug>-design.md` |
| `F121` | No `# H1` title |
| `F122` | Fewer than three `##` sections |

**Plan documents**

| Code | Condition |
|---|---|
| `F101` | Filename is not `<YYYY-MM-DD>-<slug>.md` |
| `F105` | No `# H1` title |
| `F106` | Missing `**Goal:**` |
| `F108` | `**Spec:**` is present but does not resolve to an existing file |
| `F109` | No `Task N:` heading at any level from `##` to `####` |
| `F110` | A task has no `- [ ]` step |

**Warnings**

| Code | Condition |
|---|---|
| `F111` | A task states no `Expected:` or `Verify:` |
| `F112` | Missing `**Architecture:**` |
| `F130` | A design document with no plan document of the same slug |
| `F131` | The repository contains both the `spec` and the `plan` document sets |
| `F132` | `config.yaml` names a format the documents do not match |

`F132` compares the declared format against what is on disk, so a repository that switched
formats without finishing the migration is told so rather than silently serving two truths.

`F111` is a warning rather than an error because front-end and tooling tasks are routinely
covered by a later end-to-end checklist instead of their own `Expected:` line. It is still
worth saying — a task whose completion nobody can observe is how a plan quietly stops being
executable. This calibration is not a guess: the checks were run against eight plan and eight
design documents produced by hand, and the strict version of `F111` rejected most of them for
omissions the documents had legitimately compensated for elsewhere.
