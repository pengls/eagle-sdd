---
name: eagle-sdd
description: Use when the user asks for spec-driven development by name — "/eagle-sdd", "run spec-driven development", "SDD", "write the spec first", "spec this before coding", "grill me then spec it". Explicit request only.
license: MIT
compatibility: Needs a writable repository and a way to run a command. The optional validator needs Node 18 or newer.
disable-model-invocation: true
metadata:
  version: "2.0.0"
  workflow: spec-driven-development
---

# Spec-Driven Development

Write the design first. Plan it task by task. Implement against the plan. Verify against the
design. Then stop.

## The contract

Four rules carry this workflow. Everything else is mechanics.

1. **No implementation before the design is approved.** The design is a human decision, not an
   agent artifact. You draft it; the user approves it.
2. **No plan without a design.** A plan document belongs to exactly one design document of the
   same name. Writing the plan first inverts the pair and leaves no record of why.
3. **No completion claim without fresh verification evidence.** A task is done when you have run
   a check, read its output, and reported what it said — in this session. Prior runs and
   subagent success reports are not evidence.
4. **A dated document is frozen.** Neither document of a pair is rewritten after it is written.
   A decision that changes later becomes a new dated pair, not an edit.

## Scope check

This workflow costs real time — a design document, a plan, and a task-by-task execution. Route
before you commit to it, and say your route out loud in one line.

| The request | Route |
|---|---|
| Mechanical edit — rename, typo, formatting, dependency bump | Say so. Do not open this workflow. |
| A bug with one plausible cause | Fix it. |
| A change that fits in one commit and one paragraph | Say so. Do not open this workflow. |
| Ambiguous, multi-session, or it changes a shared contract | Run the full workflow. |
| Greenfield | Run the full workflow. |

Two things the scope check does **not** license: skipping the grill because the request sounds
clear, and skipping verification because the change is small. If you opened the workflow, you
run it.

## The loop

Eight steps. Each names what it produces and the condition that ends it. Do not leave a step
until its condition holds, and do not begin a step before the one it depends on is finished.

### 1. Orient

**Resolve the project configuration first.** Look for `eagle-sdd.yml` at the project root — the
nearest ancestor of the working directory that contains it, or the working directory itself.

**If it exists, read it and use it. Do not ask again.** It is the source of truth for the whole
run, including settings the user may have edited since last time.

**If it does not exist, this is the project's first run.** Ask two structured questions, then
write the file:

1. **Where should the documents live?** Recommend `docs/eagle-sdd`. The answer is stored relative
   to the project root, so the directory can be moved later by editing one line.
2. **May the workflow touch git?** Recommend yes. Yes means it initialises a repository when the
   project has none and commits after each finished task. No means it never runs a git command,
   and the plan carries no commit steps.

```yaml
# eagle-sdd project configuration. Edit this file directly; nothing rewrites it.
#
# docs  where the design-and-plan pairs live, relative to this file.
# git   true  - initialise a repository if the project has none, and commit
#               after each finished task.
#       false - leave version control entirely alone.

docs: docs/eagle-sdd
git: true
```

Write it at the project root, not inside the documents directory — the file is what says where
that directory is, so it cannot live inside it. Tell the user the path you wrote, so they know the
file exists and that later changes are theirs to make by editing it.

For the rest of this document, **`<docs>` means the configured documents directory**, default
`docs/eagle-sdd`.

Then read `<docs>/designs/` and `<docs>/plans/`. You are looking for a prior pair covering the same
ground — a decision already made, an approach already rejected, a file already touched.
Re-deciding something the repository already settled is the most common way this workflow wastes
the user's time.

Then name the change:

- **Slug** — kebab-case, act-shaped, describing the change rather than the feature:
  `store-search-layout`, not `store`.
- **Date** — today, `YYYY-MM-DD`.
- **Identity** — `<date>-<slug>`. This is the change's name everywhere.

It becomes exactly two files:

```
<docs>/designs/<date>-<slug>-design.md
<docs>/plans/<date>-<slug>.md
```

The date and slug must match in both. The validator pairs them on it; nothing else joins them.

If a pair with that identity already exists, pick a different slug — never overwrite a frozen
document. A change of mind is a new pair with a new date.

**Done when** the configuration is resolved and you can state in one sentence each: what the
existing documents already cover, what this change alters, and the change's identity.

### 2. Grill

Resolve ambiguity before you write anything. Ask about one decision at a time, and ask it as a
**structured question with options**, not as prose.

A prose question ends your turn and leaves the decision dangling. A structured question carries
the options, forces the decision, and lets you continue in the same breath. This is the single
highest-leverage mechanic in this workflow, and steps 3 and 4 depend on it: every decision you do not
settle here becomes a paragraph the user has to read and argue with later.

Rules of the grill:

- **Ask about decisions, not facts.** Read the repository instead of asking what the repository
  already says.
- **Offer 2–4 concrete options and say which one you recommend, and why.** "What do you want?"
  is not a question; it is a shrug.
- **One decision per question.** Bundling decisions produces bundled answers.
- **Ask until the design has no branches left.** The test is not "do I feel informed" but "could
  two competent people write different design documents from what I have". If yes, keep asking.
- **Stop when the remaining unknowns cannot change the design.** Curiosity is not ambiguity.
- **Destructive or irreversible actions are never assumed.** Ask, always.

If the user declares a decision closed, or tells you to proceed on your judgement, record it as
a ruling rather than asking again — and it goes into the design document, not into a comment:

```markdown
> **Ruling:** <what you decided> — <why> — <what it costs if wrong>
```

**Done when** every open decision is either answered by the user or recorded as a ruling, and
none of them can still change what you are about to build.

### 3. Summarize

Before you commit any detail to a document that freezes, state back what you understood and how
you intend to solve it — in plain language — and get agreement. This is the cheapest place in the
workflow to discover you have solved the wrong problem.

**This step writes no file.** It is a message and a conversation. Nothing goes on disk until the
user agrees with what you are about to put there.

The summary covers six things, in this order:

1. **The problem, as you understood it** — one or two sentences, in the user's terms. If you
   cannot state it without hedging, the grill is not finished; go back to step 2.
2. **The approach** — how you intend to solve it, at the level of "the store page gets a
   collapsible filter row", not "add `.search-actions` with `margin-left: auto`".
3. **The decisions** — each one with the option it beat.
4. **Out of scope** — what you are deliberately not doing, and what must not break.
5. **Assumptions and open risks** — what you are unsure about, and what you are taking for granted.
   An unstated assumption is the most likely reason the design turns out wrong.
6. **The question** — close by asking directly whether anything is wrong, missing, or needs
   clarifying.

Rules:

- **No code, no file paths, no class names.** Those belong in the design document. A summary that
  carries the detailed design turns step 4 into a rubber stamp.
- **Short.** If it is longer than the original request, it is not a summary.
- **It is a conversation, not an announcement.** Answer the replies. If one changes a decision,
  revise the summary and present it again — do not patch the answer into the design document later
  and hope the user notices.
- **Keep going until the user confirms.** Agreement to one part is not agreement to the whole. Do
  not proceed because the user went quiet: end your turn on the question and wait.
- **A "just go ahead" is a ruling.** Record it, and carry it into the design document like any
  other.

> **GATE — the user confirms the summary before the design document is written.** Present it and
> stop.

**Done when** the user has confirmed the summary, or told you to proceed — and if anything changed
during the exchange, the revised summary has been shown.

### 4. Design document

Write `<docs>/designs/<date>-<slug>-design.md` from `assets/templates/design-doc.md`.
Read `references/plan-format.md` for the grammar and the checks.

Six sections, in order: requirement summary, confirmed decisions, current state and problem,
detailed design, out of scope, how to verify. The template says what belongs in each.

Section 2 is the one that earns the document its keep: a decision recorded without the option it
beat gets relitigated by the next reader.

Write the document in the language the user is working in.

> **GATE — the user approves the design before you write the plan.** Present the decisions and
> the out-of-scope list, and stop. This is the last cheap moment to change your mind: everything
> downstream is derived from this document, and it is frozen once approved.

**Done when** the design document exists and the user has approved it.

### 5. Plan document

Write `<docs>/plans/<date>-<slug>.md` from `assets/templates/implementation-plan.md`.
Same date, same slug as the design it implements.

Four header lines open it:

- `**Goal:**` — what is true about the system after this plan runs that is not true now.
- `**Architecture:**` — the shape of the change: which layers move, and what deliberately does not.
- `**Tech Stack:**` — only what this change actually touches.
- `**Spec:**` — the path to its design document.

Then a file-structure table (every file created, modified, or deleted, and its role), then the
tasks. `references/plan-format.md` says which of the four are enforced and which are warnings.

**A task is one independently verifiable work item.** Every task has:

1. **`### Task N: <title>`** — at any heading level from `##` to `####`.
2. **`**Files:**`** — the files it touches, and where in them.
3. **Checkbox steps** — `- [ ] **Step N: …**`, in order.
4. **A verification step** — `Run:` with a command and `Expected:` with the specific observable
   outcome; or `Verify:` with the observation when there is no command to run.
5. **A commit step** — `git add` the files, `git commit`. The commit is what makes a task cheap
   to undo, and the git history becomes the execution record the design document cannot hold.
   **Omit this step from every task when the configuration says `git: false`.**

Rules that make a plan executable by someone who was not in the conversation — which is the
normal case, and often a fresh agent with no memory of it:

- **Show the code in the step.** "Update the handler to reject expired sessions" is not a step.
  The replacement code is. If a step is "replace X with Y", show both.
- **One task, one sitting.** A task that cannot be finished, verified, and committed in one go
  should be two tasks.
- **Order by dependency.** A task never depends on one that comes later.
- **State the observation, not the intention.** `Expected: exit code 0, no error output` is
  checkable. `Expected: it works` is not.
- **Reserve a separate verification task** for integration behavior that genuinely spans several
  tasks — an end-to-end checklist, for instance. Everything else verifies in its own task.

> **GATE — the user sees the task list before implementation starts.** Present the task titles
> and the file-structure table, and stop.

**Done when** every task has its steps, its verification, and — when git is enabled — its commit;
the plan names its design document; and `node <skill-dir>/scripts/validate.mjs` reports no errors.

### 6. Implement

Work the tasks in order, one at a time.

**Read one task at a time, not the whole plan.** A plan runs long because every step carries its
code; reading all of it to do task 1 holds all of it in context for the rest of the run, and
invites starting task 4 while task 2 is unverified. Read the task you are about to do, do it, then
read the next one when you get there.

For each task:

1. Make the change the steps describe.
2. Run the verification step.
3. **Read the output**, including the exit code.
4. Only then tick the boxes.
5. Commit, with the message the plan gives — when the configuration enables git.

Tick a box **after** you have read the verification output, never before. A tick is a claim, and
rule 3 applies to it.

**When a task turns out to be wrong** — the design was misread, the approach does not work, a
file is not where the plan said — stop and fix the document before the code. In the normal case
the design document is frozen, so a wrong design is corrected by a *new dated pair*, not by an
edit; the plan is not frozen in the same way, but changing it silently is the same failure in a
smaller costume. Never edit code to match a design you no longer believe: that is how drift
starts, and it is invisible in the diff.

**When a task blocks** — a dependency is missing, a credential is absent, the environment cannot
run the check — report the block with what you tried, and stop. Do not silence it by weakening
the verification, and do not tick a box you could not check.

**Done when** every box is ticked, every verification step has been run and read in this session,
and every task the plan marked for commit is committed.

### 7. Verify

Read `references/verification.md` and run its gate. Verification asks a different question from
"do the tests pass": it asks **is this the thing we agreed to build**, section by section against
the design document.

The per-task `Run:`/`Expected:` pairs cover the mechanical half — each task did what its steps
said. This step is the half they cannot cover:

- Walk the design document's `## 4. Detailed design` and `## 1. Requirement summary`. For each
  part, name the evidence — the test, the command, the observation — and say whether you
  produced it in this session.
- Check `## 5. Out of scope` actually held: nothing outside it changed.
- Run what `## 6. How to verify` prescribes. That section exists precisely because it is the
  part no task-level check covers.

Parts of the design with no evidence are not verified, however green the suite is.

Dispatched work is verified by a fresh reviewer with no memory of writing it — and returns
separate verdicts for spec compliance and for correctness, because a change can pass one and
fail the other. A worker reporting success is not evidence; it is a claim to be checked.

**Done when** every part of the design maps to evidence you ran and read, and any gap is
reported to the user as a gap rather than smoothed over.

### 8. Close

There is no merge and no archive step. The pair was frozen at its date when it was written.

1. Re-read the plan document. Confirm every box is ticked, and that every task carrying a commit
   step has been committed.
2. Confirm the plan's `**Spec:**` line still resolves to its design document.
3. Run `node <skill-dir>/scripts/validate.mjs` and confirm it is clean.
4. Report to the user: the change's identity, the two file paths, and anything in step 7 that
   stayed unverified.

**Done when** the validator is clean, the pair is complete, and the user has the result.

## Gates

Three, all blocking. They exist for the same reason: everything downstream is derived from what
comes before, so an unapproved upstream step is a guess that gets built at full price. They are
not redundant — each catches a different class of mistake, and each is cheaper than the one after
it.

| After | The user approves | The mistake it catches |
|---|---|---|
| Step 3, the summary | The problem and the approach | You are solving the wrong problem |
| Step 4, the design document | The decisions, and what is out of scope | The right problem, solved the wrong way |
| Step 5, the plan document | The task breakdown, before any code is written | The right solution, decomposed badly |

A gate is passed by the user, not by you deciding it is fine, and not by the user having said
something encouraging earlier. If you are unsure whether a gate passed, it did not.

## When you feel the pull to skip

These are the thoughts that precede a broken change. Each one is a signal, not a reason.

| The thought | What is actually true |
|---|---|
| "This is simple enough to skip the design" | Simple changes are where drift starts unnoticed. If it is truly mechanical, the scope check already routed you out. |
| "I'll write the design after, once I know the shape" | A design written after the code describes the code, bugs included. It cannot tell you what you should have built. |
| "The design is obvious, I'll write the plan first" | The plan's `**Spec:**` points at the design. Writing it first inverts the pair and leaves no record of why. |
| "I already asked enough questions" | The test is whether two competent people could write different designs from what you have, not whether you feel informed. |
| "The tests pass, so it's verified" | Tests answer "does it work". The design answers "is this what we agreed to build". Different questions. |
| "I already ran that check earlier" | Prior runs are not evidence. State is not preserved between then and now. Run it again. |
| "The subagent said it was done" | A success report is a claim. Go and read the artifact. |
| "This task is clearly fine, it needs no Expected:" | Then writing the observation takes twenty seconds, and it is the only thing that tells the next reader what "done" meant. |
| "I'll fold this decision into the design doc later" | That document is frozen at its date. A changed decision is a new dated pair, not an edit. |
| "The user is waiting, I'll confirm the design later" | An unapproved design is a guess. You will build the wrong thing faster. |

## Red flags — stop

- You are editing source files and no approved design document exists.
- You are about to tick a checkbox you have not verified in this session.
- A task has no `Expected:` or `Verify:` step, so nobody can tell when it is done.
- You are writing the plan document before the design document it points at.
- You are editing a design document that was already approved.
- You are explaining to yourself why this particular change is the exception.
- You are asking the user a question in prose that you could have asked with options.

## Reference

| File | Load it when |
|---|---|
| `references/plan-format.md` | Writing or validating a document — the grammar and every check |
| `references/verification.md` | Step 7, or any time you are about to claim something works |
| `references/harnesses.md` | You need to translate an action here into the tool your environment actually provides |
| `assets/templates/` | Starting either document — copy the template rather than inventing a shape |
| `scripts/validate.mjs` | After step 5 and in step 8 — `node scripts/validate.mjs` |

Layout this workflow owns, and nothing else:

```
<project root>/
├── eagle-sdd.yml                            # docs path, and whether git is touched
└── <docs>/                                  # default: docs/eagle-sdd
    ├── designs/<YYYY-MM-DD>-<slug>-design.md   # the design, frozen at its date
    └── plans/<YYYY-MM-DD>-<slug>.md            # its implementation plan
```

The configuration file sits at the project root, never inside `<docs>` — it is what says where
`<docs>` is.

Templates: `design-doc.md` and `implementation-plan.md`.
