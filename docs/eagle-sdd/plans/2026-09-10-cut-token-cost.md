# Cut the skill's token cost Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Written as the record of a change that was already made and verified; every `Run:` below was executed and its output read.

**Goal:** the skill's per-run instruction load drops, its document shapes live in exactly one place, and implementation no longer pulls a whole plan into context to start its first task.

**Architecture:** subtraction plus one added rule. `plan-format.md` stops reproducing the two document shapes and points at the templates, which become the single source for shape; the rules it carries are untouched. `SKILL.md` states each shape once, in its shortest form. Step 6 gains the instruction to read one task at a time. Nothing in the discipline layer — the rationalisation table, the red flags, the gate table, the evidence gate — is touched.

**Tech Stack:** Markdown, zero-dependency Node 18+ ESM, `node:test`.

**Spec:** `docs/eagle-sdd/designs/2026-09-10-cut-token-cost-design.md`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `skills/eagle-sdd/references/plan-format.md` | Modify | Drop the two worked examples; point at the templates; keep every rule and check |
| `skills/eagle-sdd/SKILL.md` | Modify | Add the read-one-task rule; state each document shape once |
| `docs/eagle-sdd/` | Add | This change's pair |

---

### Task 1: Add the read-one-task rule

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`

- [x] **Step 1: Add the rule to step 6**

After "Work the tasks in order, one at a time.", add that the plan is read one task at a time and
not as a whole, with the reason: reading all of it to do task 1 holds all of it in context and
invites starting a later task while an earlier one is unverified.

- [x] **Step 2: Verify the rule is present and the body budget holds**

Run: `rg -n "Read one task at a time" skills/eagle-sdd/SKILL.md`
Expected: one match

- [x] **Step 3: Commit**

```bash
git add skills/eagle-sdd/SKILL.md
git commit -m "workflow: read one task at a time during implementation"
```

---

### Task 2: Remove the duplicated document shapes

**Files:**
- Modify: `skills/eagle-sdd/references/plan-format.md`

- [x] **Step 1: Replace the design example with a pointer**

"Copy `assets/templates/design-doc.md`", then the shape in one sentence: H1, three metadata lines,
six numbered sections, named. Keep the required/optional rule, the write-it-first rule and the
frozen rule exactly as they were.

- [x] **Step 2: Replace the plan example with a pointer**

"Copy `assets/templates/implementation-plan.md`", then the shape in one sentence. Keep the four
header lines paragraph, the task requirements, the show-the-code rule and the commit-per-task rule.

- [x] **Step 3: Verify the templates are still referenced and still exist**

Run: `rg -n "assets/templates" skills/eagle-sdd/references/plan-format.md`
Expected: both template names appear, and both files exist under `assets/templates/`

- [x] **Step 4: Verify no rule was lost**

Run: `rg -c "^\*\*" skills/eagle-sdd/references/plan-format.md`
Expected: the same count of bolded rule paragraphs as before the edit, minus the two examples

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd/references/plan-format.md
git commit -m "format: point at the templates instead of reproducing them"
```

---

### Task 3: State each shape once in the spine

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`

- [x] **Step 1: Collapse the six-section table in step 4**

The section names stay; the "what it holds" column goes, because the template carries it.

- [x] **Step 2: Trim the four header-line descriptions in step 5**

One clause each, plus a pointer to the reference for which are enforced and which are warnings.

- [x] **Step 3: Trim the justification prose in step 3**

Keep every rule about the summary; cut the sentences that argue for the step rather than instruct
within it.

- [x] **Step 4: Verify every rule survives**

Run: `rg -n "No code, no file paths|Short\.|conversation, not an announcement|Keep going until|just go ahead" skills/eagle-sdd/SKILL.md`
Expected: all five summary rules still present

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd/SKILL.md
git commit -m "skill: state each document shape once"
```

---

### Task 4: Measure and record

**Files:**
- Add: `docs/eagle-sdd/designs/2026-09-10-cut-token-cost-design.md`
- Add: `docs/eagle-sdd/plans/2026-09-10-cut-token-cost.md`

- [x] **Step 1: Measure the per-run load before and after**

Run the same character count over `SKILL.md` + `plan-format.md` + `verification.md` + both
templates, and report the real delta — including if it is smaller than the estimate that motivated
the change.

- [x] **Step 2: Verify encoding survived the edits**

Run: `node -e "const t=require('fs').readFileSync('skills/eagle-sdd/SKILL.md','utf8'); console.log('replacement chars:', (t.match(/\uFFFD/g)||[]).length)"`
Expected: `0`

- [x] **Step 3: Verify the suite and the repository**

Run: `node --test`
Expected: 36 passing, 0 failing

Run: `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add docs/eagle-sdd
git commit -m "docs: record the token-cost reduction and what it actually bought"
```
