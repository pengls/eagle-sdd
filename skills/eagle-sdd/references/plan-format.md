# The `plan` format

This skill produces one document set: **a dated design document paired with a dated
implementation plan**, one pair per change. Nothing accumulates and nothing is merged. The
design document is the record of what was decided; the plan document is the record of what was
done.

## Contents

- [Layout](#layout)
- [designs/&lt;date&gt;-&lt;slug&gt;-design.md](#designsdate-slug-designmd)
- [plans/&lt;date&gt;-&lt;slug&gt;.md](#plansdate-slugmd)
- [The pair](#the-pair)
- [Checks](#checks)

## Layout

```
docs/eagle-sdd/
├── designs/<YYYY-MM-DD>-<slug>-design.md    # one per change, frozen at its date
└── plans/<YYYY-MM-DD>-<slug>.md             # the implementation plan for that design
```

Both directories are flat. The filename carries the date and the slug, so a change is identified
by `2026-08-04-store-search-layout` rather than by a directory. Those two files are the entire
output — there is no index, no manifest, and no configuration file.

## designs/&lt;date&gt;-&lt;slug&gt;-design.md

The design document. It carries the why, the what, and the decisions, in one dated file.

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

**Required:** an `# H1` title, and at least three `##` sections. Section *names* are not checked —
the numbered list above is the convention, not the contract, and the headings may be translated.

**Write it before the plan.** The plan document points at this one; there is no ordering in which
the plan exists first.

**Frozen at its date.** Nothing rewrites a design document later. A change of mind is a new dated
pair, not an edit. That is the trade this format makes: you gain a durable record of what was
decided on a given day, and you give up a single current description of the system.

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

**The four header lines.** `**Goal:**` is required. `**Architecture:**` is expected and warned
about when absent. `**Spec:**` is expected and warned about when absent, and when it *is* present
it must resolve to a design document that exists — a plan pointing at a design that is not there
is worse than a plan with no link at all. `**Tech Stack:**` is conventional and unchecked.

**One `Task N: <title>` per task**, at any heading level from `##` to `####` — both are in common
use. Every task needs:

- at least one `- [ ]` step, and
- a verification step: a `Run:` line and an `Expected:` line, or `Verify:` with a command.

A task whose completion nobody can observe is a heading, not a task.

**Show the code in the step.** "Update the handler to reject expired sessions" is not a step; the
replacement code is. The plan is executed by someone who was not in the conversation that
produced it — quite often by a fresh agent with no memory of it.

**Commit per task.** The third step of every task. The commit is what makes a task cheap to undo,
and the git history becomes the record of execution the design document cannot hold.

## The pair

A design document and its plan document share one identity: `<YYYY-MM-DD>-<slug>`. The validator
pairs them on that, not on anything inside the documents.

Why not join on the `**Spec:**` link: plenty of hand-written plans omit it, and a format that
refuses to recognise a correct pair because a convenience line is missing is a format that gets
worked around. The slug is structural; the link is a courtesy, and a broken courtesy still fails.

Two consequences worth knowing:

- **The date is part of the identity.** Re-running the workflow on the same change later produces
  a second pair. That is deliberate, and it is what makes the record append-only.
- **An orphan design is reported.** A design document with no plan of the same slug is a warning,
  because it usually means the plan was renamed, misfiled, or never written.

## Checks

`node scripts/validate.mjs [root]` defaults to `docs/eagle-sdd`. Zero dependencies, Node 18+.
It exits `1` on any error; warnings never change the exit code.

**The tree**

| Code | Kind | Condition |
|---|---|---|
| `F000` | error | No document tree at the given root, or no documents inside it |

**Design documents**

| Code | Kind | Condition |
|---|---|---|
| `F101` | error | Filename is not `<YYYY-MM-DD>-<slug>-design.md` |
| `F121` | error | No `# H1` title |
| `F122` | error | Fewer than three `##` sections |

**Plan documents**

| Code | Kind | Condition |
|---|---|---|
| `F101` | error | Filename is not `<YYYY-MM-DD>-<slug>.md` |
| `F105` | error | No `# H1` title |
| `F106` | error | Missing `**Goal:**` |
| `F107` | warning | Missing `**Spec:**` |
| `F108` | error | `**Spec:**` is present but does not resolve to an existing file |
| `F109` | error | No `Task N:` heading at any level from `##` to `####` |
| `F110` | error | A task has no `- [ ]` step |
| `F111` | warning | A task states no `Expected:` or `Verify:` |
| `F112` | warning | Missing `**Architecture:**` |

**Across the pair**

| Code | Kind | Condition |
|---|---|---|
| `F130` | warning | A design document with no plan document of the same slug |

### Why the warnings are warnings

`F111` was an error in the first version, and it rejected most of eight hand-written plan
documents — front-end and tooling tasks are routinely covered by a later end-to-end checklist
instead of their own `Expected:` line. `F107` was an error too, until it turned out that seven of
those eight plans simply did not carry the line.

That calibration was not a guess: the checks were run against sixteen real documents before the
rules were settled. The principle it produced is worth keeping — **a check that fails correct work
gets disabled, and a disabled check protects nothing.** Report the omission, do not reject the
document.

The errors are the things that are unambiguously broken: a document nobody can find, a link that
points nowhere, a task with no steps. Those never have a legitimate exception.
