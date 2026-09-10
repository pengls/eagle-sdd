# Add the Summarize step Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Written as the record of a change that was already made and verified; every `Run:` below was executed and its output read.

**Goal:** the workflow has an eighth step that states back, in plain language, what was understood and how it will be solved, blocks on the user's confirmation, and only then lets the design document be written — so a misread requirement is caught in a chat message rather than in a frozen document.

**Architecture:** an insertion plus a renumber. `SKILL.md` gains `### 3. Summarize` between Grill and Design document; the five steps after it shift by one, and every cross-reference to them is updated across the skill, the docs and the README. The gates table grows from two rows to three and gains a column naming the mistake each gate catches. No document type, template, or validator code changes — the step writes nothing to disk.

**Tech Stack:** Markdown, zero-dependency Node 18+ ESM, `node:test`.

**Spec:** `docs/eagle-sdd/designs/2026-09-10-add-summarize-step-design.md`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `skills/eagle-sdd/SKILL.md` | Modify | Insert step 3, renumber 3–7 to 4–8, three-gate table |
| `skills/eagle-sdd/references/plan-format.md` | Modify | State that the summary is not one of the two documents |
| `skills/eagle-sdd/references/verification.md` | Modify | Two step references move |
| `docs/WORKFLOW.md` | Modify | The new step, renumbering, the three-gate section, the worked transcript |
| `README.md` | Modify | Eight steps, the gate table, the "Use" framing |
| `AGENTS.md` | Modify | The step count |
| `docs/eagle-sdd/` | Add | This change's pair |

---

### Task 1: Insert the step and renumber

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`

- [x] **Step 1: Insert `### 3. Summarize` between Grill and Design document**

Six required contents, the three failure modes (not a design document, not long, not an
announcement), the multi-turn loop, and a blocking gate.

- [x] **Step 2: Renumber the steps after it, highest first**

Design document 3→4, Plan 4→5, Implement 5→6, Verify 6→7, Close 7→8. Do it in that order — a
lowest-first pass re-matches the line it just renamed.

- [x] **Step 3: Verify the headings and the step count**

Run: `rg -n "^### \d+\." skills/eagle-sdd/SKILL.md`
Expected: eight headings, numbered 1 through 8 with no repeat

- [x] **Step 4: Verify the body budget still holds**

Run: `node --test tests/skill.test.mjs`
Expected: the progressive-disclosure test passes, so the body is under 500 lines

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd/SKILL.md
git commit -m "workflow: add the Summarize step between the grill and the design"
```

---

### Task 2: Fix the cross-references

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`, `skills/eagle-sdd/references/verification.md`

- [x] **Step 1: Move the internal references in SKILL.md**

The grill "step 3 depends on it" becomes steps 3 and 4; the reference table's verify row becomes
step 7, and the validator row becomes "after step 5 and in step 8". The Close step's report line
becomes step 7. The count reads "eight steps".

- [x] **Step 2: Move the two references in verification.md**

Its opening line points at step 7, and its design-defect sentence points at the gate at step 4.

- [x] **Step 3: Verify no reference points at the old numbering**

Run: `rg -n "step [0-9]|Step [0-9]" skills/eagle-sdd/SKILL.md skills/eagle-sdd/references/`
Expected: every hit agrees with the eight-step numbering

- [x] **Step 4: Commit**

```bash
git add skills/eagle-sdd
git commit -m "workflow: update step references for the new numbering"
```

---

### Task 3: Three gates

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`

- [x] **Step 1: Rewrite the Gates section**

Three rows instead of two, and a column naming the mistake each gate catches — wrong problem,
wrong solution, bad decomposition. Without that column three blocking gates reads as bureaucracy.

- [x] **Step 2: Verify the section is self-consistent**

Run: `rg -n "Two, both blocking|Step 3, the design document" skills/eagle-sdd/SKILL.md`
Expected: no matches

- [x] **Step 3: Commit**

```bash
git add skills/eagle-sdd/SKILL.md
git commit -m "workflow: document three gates, each naming the mistake it catches"
```

---

### Task 4: State that the summary is not a document

**Files:**
- Modify: `skills/eagle-sdd/references/plan-format.md`

- [x] **Step 1: Add the note**

The format reference describes exactly two documents. A reader who has just met step 3 will
reasonably ask where its output goes, so say it: a message, never written to disk, redundant the
moment the design document exists.

- [x] **Step 2: Verify the reference still documents exactly the emitted codes**

Run: `node --test tests/skill.test.mjs`
Expected: the bidirectional code test passes, so the edit introduced no stray code literal

- [x] **Step 3: Commit**

```bash
git add skills/eagle-sdd/references/plan-format.md
git commit -m "format: say that the alignment summary is not one of the two documents"
```

---

### Task 5: Rewrite the walkthrough

**Files:**
- Modify: `docs/WORKFLOW.md`

- [x] **Step 1: Insert the step and renumber**

Same order as task 1. The contents list, the eight step headings, and the gate markers all move.

- [x] **Step 2: Expand the gates section**

`## The two gates` becomes `## The three gates`, with the mistake each one catches, and the
observation that the first gate pays for itself most often.

- [x] **Step 3: Extend the worked transcript**

Show the summary being presented, the user asking a question the design document would have
buried, and the answer. A transcript where the summary changes nothing does not show the step
earning its turn.

- [x] **Step 4: Verify every step is present and the anchors resolve**

Run: `rg -n "^## Step [0-9]" docs/WORKFLOW.md`
Expected: eight headings, numbered 1 through 8, matching the contents list

- [x] **Step 5: Commit**

```bash
git add docs/WORKFLOW.md
git commit -m "docs: walk the Summarize step, and three gates instead of two"
```

---

### Task 6: Update the README

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [x] **Step 1: Eight steps, and the gate table**

Add the step-3 row, renumber the rest, add the gate table, and say in the "Use" section that the
first gate is a conversation rather than a document.

- [x] **Step 2: Update the step count in AGENTS.md**

- [x] **Step 3: Verify**

Run: `rg -n "seven steps|The seven" README.md AGENTS.md`
Expected: no matches

- [x] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: the README describes eight steps and three gates"
```

---

### Task 7: Record the change

**Files:**
- Add: `docs/eagle-sdd/designs/2026-09-10-add-summarize-step-design.md`
- Add: `docs/eagle-sdd/plans/2026-09-10-add-summarize-step.md`

- [x] **Step 1: Write the pair, and tick it**

Every `Run:` above was executed and its output read.

- [x] **Step 2: Verify the repository validates clean**

Run: `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd`
Expected: `OK`, no warnings

- [x] **Step 3: Verify the full suite**

Run: `node --test`
Expected: 33 passing, 0 failing

- [x] **Step 4: Commit**

```bash
git add docs/eagle-sdd
git commit -m "docs: record the Summarize step as a plan-format pair"
```
