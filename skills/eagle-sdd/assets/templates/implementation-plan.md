# <Title> Implementation Plan

<!--
The `plan` format's second document. Task-by-task, with the exact code and the
exact command that proves each step landed.

Filename: docs/eagle-sdd/plans/<YYYY-MM-DD>-<slug>.md
The date and slug must match the design document this points at.
-->

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Work the tasks in order; do not start a task before the one it depends on is verified.

**Goal:** <One paragraph. What is true about the system after this plan is executed that is not true now.>

**Architecture:** <One paragraph. The shape of the change: which layers move, which pattern is used, and what deliberately does not change.>

**Tech Stack:** <Languages, frameworks, and libraries this change actually touches.>

**Spec:** `docs/eagle-sdd/designs/<YYYY-MM-DD>-<slug>-design.md`

---

## File structure

<!-- Every file that will be created, modified, or deleted, and its role. If the
     plan is more than a handful of files this table is what a reviewer reads
     first. -->

| File | Change | Responsibility |
|---|---|---|
| `<path>` | Create / Modify / Delete | <what it does after this change> |

---

### Task 1: <title>

**Files:**
- Modify: `<path>`（<where in the file>）

- [ ] **Step 1: <action>**

<!-- The exact edit. Show the code, not a description of the code. If a step is
     "replace X with Y", show both. -->

- [ ] **Step 2: Verify**

Run: `<command>`
Expected: <the specific observable outcome, not "it works">

- [ ] **Step 3: Commit**

```bash
git add <paths>
git commit -m "<type>: <what changed>"
```

---

### Task 2: <title>

**Files:**
- Modify: `<path>`

- [ ] **Step 1: <action>**

- [ ] **Step 2: Verify**

Run: `<command>`
Expected: <outcome>

<!--
RULES THE VALIDATOR ENFORCES (references/plan-format.md)

- The `**Goal:**`, `**Architecture:**`, `**Tech Stack:**` and `**Spec:**` header
  lines are mandatory. `**Spec:**` must resolve to a design document that exists.
- At least one `### Task N: <title>` heading.
- Every task must contain at least one `- [ ]` step.
- Every task must contain a verification step: a `Run:` line followed by an
  `Expected:` line. A task whose completion nobody can observe is not a task.
- The filename must be `<YYYY-MM-DD>-<slug>.md`, and the slug must match the
  design document's.

Keep each task small enough to finish, verify, and commit in one sitting. Order
tasks so a task never depends on one that comes later. Commit per task: the git
history is what makes a failed task cheap to undo.
-->
