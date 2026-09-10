# The workflow, step by step

This is a walkthrough for a human reader: what the skill does, in order, and what you are
expected to decide at each point. It is not the contract — [`SKILL.md`](../skills/eagle-sdd/SKILL.md)
is what the agent actually follows, and where the two disagree the skill file wins.

A run produces exactly two files:

```
docs/eagle-sdd/designs/<YYYY-MM-DD>-<slug>-design.md   what was decided, and why
docs/eagle-sdd/plans/<YYYY-MM-DD>-<slug>.md            what was done, task by task
```

Neither is ever rewritten. That is the whole design.

---

## Contents

- [Before anything: the scope check](#before-anything-the-scope-check)
- [Step 1 — Orient](#step-1--orient)
- [Step 2 — Grill](#step-2--grill)
- [Step 3 — Design document](#step-3--design-document-gate-1)
- [Step 4 — Plan document](#step-4--plan-document-gate-2)
- [Step 5 — Implement](#step-5--implement)
- [Step 6 — Verify](#step-6--verify)
- [Step 7 — Close](#step-7--close)
- [The two gates](#the-two-gates)
- [What the workflow refuses to do](#what-the-workflow-refuses-to-do)
- [When something goes wrong mid-run](#when-something-goes-wrong-mid-run)
- [Worked example](#worked-example)
- [The validator](#the-validator)

---

## Before anything: the scope check

The workflow is deliberately expensive — a design document, a plan document, and a
task-by-task execution with a verification and a commit per task. So the first thing it does is
decide whether to run at all, and it says its route out loud in one line.

| Your request | What it does |
|---|---|
| Rename, typo, formatting, dependency bump | Declines. Says why, and stops. |
| A bug with one plausible cause | Declines. Fixes it. |
| A change that fits in one commit and one paragraph | Declines. |
| Ambiguous, multi-session, or it changes a shared contract | Runs. |
| Greenfield | Runs. |

Declining is a feature, not a failure. A workflow that runs on everything is a workflow nobody
keeps using.

Two things declining does **not** license: skipping the grill because the request sounds clear,
and skipping verification because the change is small. Once it has opened the workflow, it runs it.

---

## Step 1 — Orient

**What it reads:** `docs/eagle-sdd/designs/` and `docs/eagle-sdd/plans/`.

**What it is looking for:** a prior pair covering the same ground — a decision already made, an
approach already rejected, a file already touched. Re-deciding something the repository already
settled is the most common way this workflow wastes your time, so this step exists to stop it.

**What it produces:** the change's identity.

- **Slug** — kebab-case, act-shaped, naming the change rather than the feature:
  `store-search-layout`, not `store`.
- **Date** — today, `YYYY-MM-DD`.
- **Identity** — `<date>-<slug>`, used in both filenames.

The date is part of the identity on purpose. Running the workflow twice on the same subject
produces two pairs, which is what makes the record append-only.

**Done when** it can state, in one sentence each: what the existing documents already cover, what
this change alters, and what the change is called.

---

## Step 2 — Grill

**What it produces:** settled decisions, or explicit rulings where you told it to use its
judgement.

This is where ambiguity dies, and it is the single highest-leverage step in the workflow —
because every decision left open here becomes a paragraph you have to read and argue with in the
design document instead.

**Every question is a structured question with options, not prose.** The reason is mechanical: a
prose question ends the agent's turn and leaves the decision dangling, while a structured
question carries the options, forces a choice, and lets the agent continue in the same breath.
If your harness has no question tool, it falls back to a prose question that states plainly that
it is blocked — worse, but still far better than proceeding on a guess.

The rules it follows:

- **Ask about decisions, not facts.** It reads the repository rather than asking what the
  repository already says.
- **Two to four concrete options, with a recommendation and the reason.** "What do you want?" is
  not a question.
- **One decision per question.** Bundled decisions produce bundled answers.
- **Keep going until the design has no branches left.** The test is not "do I feel informed" but
  *"could two competent people write different design documents from what I have"*. If yes, it
  keeps asking.
- **Stop when the remaining unknowns cannot change the design.** Curiosity is not ambiguity.
- **Destructive or irreversible actions are never assumed.** Those are always asked.

**Rulings.** If you declare a decision closed, or tell it to use its judgement, it records a
ruling rather than asking again — and the ruling goes into the design document, not into a
comment:

```markdown
> **Ruling:** retry with exponential backoff, capped at 3 attempts — the upstream already
> rate-limits per key, so a queue is unnecessary — if wrong, we absorb duplicate work under load
```

The "what it costs if wrong" clause is the part that makes a ruling reviewable later.

**Done when** every open decision is answered or ruled on, and none can still change what gets
built.

---

## Step 3 — Design document <span id="gate-1"></span>

**Produces:** `docs/eagle-sdd/designs/<date>-<slug>-design.md`, from the `design-doc.md` template.

Six sections, in this order:

| | Section | What goes in it |
|---|---|---|
| 1 | Requirement summary | What is being asked, from your side, in two or three sentences. Says what this change is *not* covering if that is likely to be assumed. |
| 2 | Confirmed decisions | Every decision from step 2, as `Question \| Decision` — **including the option it beat**. |
| 3 | Current state and problem | What exists today, with real file paths and line references, and specifically what is wrong with it. |
| 4 | Detailed design | The change itself. Code goes here where code is more precise than prose, trimmed to the decision-rich parts. |
| 5 | Out of scope | What this deliberately does not touch, and what it must not break. |
| 6 | How to verify | How *you* confirm the feature is right: commands, URLs, accounts, expected observations. |

**Section 2 is the one that earns the document its keep.** A decision recorded without the option
it beat gets relitigated by the next reader. A decision recorded with it does not — and "the next
reader" is usually you, three months later.

**Section 6 is the half no task can cover.** Per-task checks prove each step landed; section 6 is
about whether the *feature* is right.

> ### 🚦 Gate 1 — you approve the design
>
> It presents the decisions and the out-of-scope list, then **stops**.
>
> This is the last cheap moment to change your mind. Everything downstream is derived from this
> document, and it freezes the moment you approve it.

---

## Step 4 — Plan document <span id="gate-2"></span>

**Produces:** `docs/eagle-sdd/plans/<date>-<slug>.md`, from the `implementation-plan.md` template.
Same date, same slug as the design it implements.

### The four header lines

| Line | Job |
|---|---|
| `**Goal:**` | What is true about the system after this plan runs that is not true now. The first thing a fresh agent reads. |
| `**Architecture:**` | The shape of the change: which layers move, which pattern, and what deliberately does not change. |
| `**Tech Stack:**` | Only what this change actually touches. |
| `**Spec:**` | The path to its design document — the link back to the reasoning. |

Then a **file-structure table**: every file created, modified, or deleted, and its role. That
table is what a reviewer reads first.

### The anatomy of a task

```markdown
### Task 1: Add the search bar layout CSS

**Files:**
- Modify: `src/main/resources/templates/eagle/biz/store/store.ftl`（the `<style>` block）

- [ ] **Step 1: Append the CSS**

<the exact code to insert>

- [ ] **Step 2: Verify**

Run: `rg -n "search-actions|more-search" src/main/resources/templates/eagle/biz/store/store.ftl`
Expected: at least four matching lines, no error

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/templates/eagle/biz/store/store.ftl
git commit -m "style: store search bar layout CSS"
```
```

Five things every task has:

1. **A heading** — `### Task N: <title>`, at any level from `##` to `####`.
2. **`**Files:**`** — what it touches, and where in them.
3. **Checkbox steps** — `- [ ] **Step N: …**`, in order.
4. **A verification step** — `Run:` with a command and `Expected:` with the specific observable
   outcome. When there is no command to run, `Verify:` with the observation.
5. **A commit step** — the commit is what makes a task cheap to undo, and the git history becomes
   the execution record the design document cannot hold.

And the rules that make a plan executable by someone who was not in the conversation — which is
the normal case, and usually a fresh agent with no memory of it:

- **Show the code in the step.** "Update the handler to reject expired sessions" is not a step.
  The replacement code is. If a step is "replace X with Y", show both.
- **One task, one sitting.** If it cannot be finished, verified, and committed in one go, it
  should be two tasks.
- **Order by dependency.** A task never depends on one that comes later.
- **State the observation, not the intention.** `Expected: exit code 0, no error output` is
  checkable. `Expected: it works` is not.
- **A separate verification task only for integration behavior** that genuinely spans several
  tasks — an end-to-end checklist, for instance.

> ### 🚦 Gate 2 — you see the task list
>
> It presents the task titles and the file-structure table, then **stops**.
>
> No code is written before this gate. This is where a wrong decomposition costs one message
> instead of a day.

---

## Step 5 — Implement

Tasks are worked **in order, one at a time**. For each:

1. Make the change the steps describe.
2. Run the verification step.
3. **Read the output**, including the exit code.
4. Only then tick the boxes.
5. Commit, with the message the plan gives.

> Ticking a box is a claim that the task is done. So the tick comes **after** reading the output,
> never before, and never instead.

### When a task turns out to be wrong

The design was misread, the approach does not work, a file is not where the plan said. It stops
and fixes the **document** before the code.

The design document is frozen, so a wrong design is corrected by a new dated pair, not an edit.
The plan is not frozen in the same way — but changing it silently is the same failure in a smaller
costume. What must never happen is editing code to match a design nobody believes any more: that
is how drift starts, and it is invisible in the diff.

### When a task blocks

A dependency is missing, a credential is absent, the environment cannot run the check. It reports
the block with what it tried, and stops. It does not silence a block by weakening the verification,
and it does not tick a box it could not check.

---

## Step 6 — Verify

Step 5's `Run:`/`Expected:` pairs cover the mechanical half: each task did what its steps said.
This step is the half they cannot cover — **is this the thing we agreed to build?**

The gate is five steps, in order:

| | Step | Do |
|---|---|---|
| 1 | **IDENTIFY** | Name the part of the design and the exact check that settles it. |
| 2 | **RUN** | Execute it now, in this session. |
| 3 | **READ** | Read the full output, including the exit code. |
| 4 | **VERIFY** | Confirm the output actually establishes what was claimed. |
| 5 | **CLAIM** | Only now report it as verified, and report what the check said. |

**What is not evidence:**

| Not evidence | Why |
|---|---|
| A run from earlier in the session, or a previous one | State is not preserved. The code changed since. |
| "The tests pass" without the output in front of you | That is a memory of a claim, not an observation. |
| A subagent's success report | A claim. Go and read the artifact it says it produced. |
| The linter passed, so the build must pass | Two different checks. The build is one command away. |
| The code reads correctly | Reading is not running. |

**What it walks:**

- `## 4. Detailed design` and `## 1. Requirement summary` — every part maps to evidence, or is
  reported as a gap.
- `## 5. Out of scope` — confirm nothing outside it changed.
- `## 6. How to verify` — run what it prescribes. That section exists precisely because no
  task-level check covers it.

**When work was delegated**, a fresh reviewer checks it — not the agent that wrote it, and not one
that inherits its conversation. The reviewer gets the diff and the design sections, **not** the
implementer's account of what it did, because that narrative anchors it toward agreeing. It
returns separate verdicts for **spec compliance** and for **correctness**, since a change can pass
one and fail the other, and classifies each finding `PASS` / `FAIL` / `PRE-EXISTING`.

**When review does not converge**, it stops on observed signals rather than a round count: the
same finding returning after a fix, different findings on the same requirement in successive
rounds, a finding that cannot be resolved without changing the design, or the change growing past
what the design describes. It reports the impasse and lets you decide. Parking a change with a
recorded reason is a legitimate outcome; looping is not.

**Done when** every part of the design maps to evidence run and read in this session, and any gap
is reported as a gap rather than smoothed over.

---

## Step 7 — Close

There is no merge and no archive. The pair was frozen at its date when it was written.

1. Re-read the plan. Confirm every box is ticked and every task committed.
2. Confirm the plan's `**Spec:**` line still resolves to its design document.
3. Run the validator and confirm it is clean.
4. Report back: the change's identity, the two file paths, and **anything from step 6 that stayed
   unverified**.

That last point is the one people skip. A change with a known, stated gap is useful. A change
with the gap quietly omitted is a trap for whoever reads it next.

---

## The two gates

Both are blocking, and both exist for the same reason: everything downstream is derived from what
comes before, so an unapproved upstream document is a guess that gets built at full price.

| After | You approve |
|---|---|
| Step 3, the design document | The decisions, and what is out of scope |
| Step 4, the plan document | The task breakdown, before any code is written |

**A gate is passed by you, not by the agent deciding it is fine** — and not by you having said
something encouraging twenty minutes earlier. If it is unsure whether a gate passed, it did not.

---

## What the workflow refuses to do

These are the thoughts that precede a broken change. Each is a signal, not a reason.

| The thought | What is actually true |
|---|---|
| "Simple enough to skip the design" | Simple changes are where drift starts unnoticed. If it were truly mechanical, the scope check already declined. |
| "I'll write the design after, once I know the shape" | A design written after the code describes the code, bugs included. It cannot tell you what you should have built. |
| "The design is obvious, I'll write the plan first" | The plan's `**Spec:**` points at the design. Writing it first inverts the pair and leaves no record of why. |
| "I already asked enough questions" | The test is whether two competent people could write different designs, not whether the agent feels informed. |
| "The tests pass, so it's verified" | Tests answer "does it work". The design answers "is this what we agreed to build". |
| "I already ran that check earlier" | Prior runs are not evidence. State is not preserved. Run it again. |
| "The subagent said it was done" | A success report is a claim. Go and read the artifact. |
| "This task is clearly fine, it needs no `Expected:`" | Then writing the observation takes twenty seconds, and it is the only thing that tells the next reader what "done" meant. |
| "I'll fold this decision into the design later" | That document is frozen. A changed decision is a new dated pair, not an edit. |
| "The user is waiting, I'll confirm the design later" | An unapproved design is a guess. You will build the wrong thing faster. |

---

## When something goes wrong mid-run

| Situation | What happens |
|---|---|
| A task's approach does not work | Stop. Correct the documents, then the plan, then the code. Never the reverse. |
| A task cannot be verified in this environment | Report the block with what was tried. Do not weaken the check to make it pass. |
| A decision from step 2 turns out wrong | A new dated pair. The frozen design stays as the record of what was believed. |
| The change grows past the design | Stop and re-scope. An unplanned widening is drift with a plan's paperwork around it. |
| Review will not converge | Stop on the observed signal, report the impasse, park with a reason. |
| You want to change scope mid-implementation | That is a new pair, or at minimum a re-approved design. Not a quiet edit. |

---

## Worked example

A real run looks roughly like this:

```
you   /eagle-sdd  the store page search bar is unreadable, fix the layout

agent (scope check)  Not mechanical — layout + button placement + copy. Running the workflow.
                     Identity: 2026-08-04-store-search-layout

agent (step 1)  Read docs/eagle-sdd/. No prior pair covers the store page. Naming the change.

agent (step 2)  ?  Layout direction
                  A) multi-row grid        B) common filters + collapse (recommended)
                  C) grouped panels        D) other
                  → B: keeps the common case on one row without a page redesign

                ?  Where do Add / Export go?
                  A) stay in the search row   B) move to the card header (recommended)
                  → B: matches every other list page in the admin

                ?  Remember the collapse state between visits?
                  → No. Ruling: YAGNI — the page reloads often and persisting it
                    costs a preferences round trip. Cost if wrong: one extra click.

agent (step 3)  Wrote docs/eagle-sdd/designs/2026-08-04-store-search-layout-design.md
                Decisions: 5. Out of scope: order page, backend, table.
                🚦 Gate 1 — approve the design?

you   (reads it)  the collapse should be default-closed, otherwise fine

agent (step 3)  Noted. Updating the design before it is approved.

agent (step 4)  Wrote docs/eagle-sdd/plans/2026-08-04-store-search-layout.md
                8 tasks, 2 files, one end-to-end checklist task.
                validate.mjs → OK (0 errors, 0 warnings)
                🚦 Gate 2 — approve the task list?

you   go

agent (step 5)  Task 1 → rg -n "search-actions" ... → 4 matches → boxes ticked → committed
                Task 2 → ... 
                Task 5 → no Run: applicable; manual check per design §6 → recorded
                ... all 8 tasks, each verified then ticked then committed

agent (step 6)  Walked design §1 and §4 section by section against fresh evidence.
                §5 held: git diff shows only the two planned files.
                §6 checklist run in the browser.
                Delegated nothing, so no reviewer needed.
                Unverified: none.

agent (step 7)  validate.mjs → OK
                docs/eagle-sdd/designs/2026-08-04-store-search-layout-design.md
                docs/eagle-sdd/plans/2026-08-04-store-search-layout.md
                8/8 tasks, 8 commits, 0 gaps.
```

---

## The validator

```sh
node skills/eagle-sdd/scripts/validate.mjs [root]     # root defaults to docs/eagle-sdd
```

Zero dependencies, Node 18+. It checks whichever of the two documents exist and exits `1` on any
error; warnings never change the exit code. The full code list is in
[`references/plan-format.md`](../skills/eagle-sdd/references/plan-format.md#checks).

Run it after step 4 and again in step 7. It is a structural check, not a substitute for step 6 —
it can tell you a task has no verification step, and it cannot tell you whether the feature is
right.
