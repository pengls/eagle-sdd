---
name: eagle-sdd
description: Use when the user asks for spec-driven development by name — "/eagle-sdd", "run spec-driven development", "SDD", "write the spec first", "spec this before coding", "grill me then spec it". Explicit request only.
license: MIT
compatibility: Needs a writable repository and a way to run a command. The optional validator needs Node 18 or newer.
disable-model-invocation: true
metadata:
  version: "1.0.0"
  workflow: spec-driven-development
---

# Spec-Driven Development

Write the spec first. Implement against it. Verify against it. Then fold it into the truth.

## The contract

Three rules carry this workflow. Everything else is mechanics.

1. **No implementation before the spec is approved.** The spec is a human decision, not an agent artifact. You draft it; the user approves it.
2. **No completion claim without fresh verification evidence.** A task is done when you have run a check, read its output, and reported what it said — in this session. Prior runs and your own confidence are not evidence.
3. **The spec on disk is the source of truth.** When code and spec disagree, exactly one of them is wrong, and you fix it on purpose. Silent drift is the only real failure mode of this workflow.

## Scope check

This workflow costs real time. Route before you commit to it, and say your route out loud in one line.

| The request | Route |
|---|---|
| Mechanical edit — rename, typo, formatting, dependency bump | Say so. Do not open this workflow. |
| A bug with one plausible cause | Fix it. |
| A clear requirement that an existing spec already covers | Go to [Implement](#7-implement). |
| Ambiguous, multi-session, or it changes a shared contract | Run the full workflow. |
| Greenfield | Run the full workflow. |

## The loop

Every step names what you produce and the condition that ends it. Do not leave a step until its condition holds.

### 1. Orient

Read `docs/eagle-sdd/specs/` and `docs/eagle-sdd/plans/`. You are looking for the capability your change touches and any plan already in flight.

Then name the change: a kebab-case id, act-shaped, describing the delta rather than the feature — `add-session-expiry`, not `sessions`. It becomes `docs/eagle-sdd/plans/<change-id>/`.

**Done when** you can state, in one sentence each: which capabilities exist today, which one this change alters, and the change id.

### 2. Grill

Resolve ambiguity before you write anything. Ask about one decision at a time, and ask it as a **structured question with options**, not as prose.

A prose question ends your turn and leaves the decision dangling. A structured question carries the options, forces the decision, and lets you continue in the same breath. This is the single highest-leverage mechanic in this workflow.

Rules of the grill:

- **Ask about decisions, not facts.** Read the repository instead of asking what the repository already says.
- **Offer 2–4 concrete options and say which one you recommend, and why.** "What do you want?" is not a question; it is a shrug.
- **One decision per question.** Bundling decisions produces bundled answers.
- **Stop when the remaining unknowns cannot change the spec.** Curiosity is not ambiguity.
- **Destructive or irreversible actions are never assumed.** Ask, always.

If the user declares a decision closed, or tells you to proceed on your judgement, record it as a ruling rather than asking again:

```markdown
> **Ruling:** <what you decided> — <why> — <what it costs if wrong>
```

**Done when** every open decision is either answered by the user or recorded as a ruling, and none of them can still change the requirement set.

### 3. Propose

Write `docs/eagle-sdd/plans/<change-id>/proposal.md` from `assets/templates/proposal.md`. It is one to two pages and answers *why* and *what*, never *how*.

The **Capabilities** section is the load-bearing part. Every capability you list becomes a file you must write in the next step, so this section is the contract between this step and that one. List a capability as **new** when it introduces a capability, and as **modified** only when a requirement's observable behavior changes. Pure refactors, tooling, and docs change no behavior, and therefore change no spec.

**Run `node <skill-dir>/scripts/validate.mjs` after this step.** It checks that what you declared here is what you deliver below.

> **GATE — the user approves the proposal before you write specs.** Present the capability list and stop.

**Done when** the proposal exists and the user has approved its capability list.

### 4. Specify

Write one delta file per declared capability at `docs/eagle-sdd/plans/<change-id>/specs/<capability>/spec.md`, from `assets/templates/spec.md`.

A delta holds only what changes, under `## ADDED`, `## MODIFIED`, `## REMOVED`, or `## RENAMED Requirements`. The canonical spec under `docs/eagle-sdd/specs/` is not touched until [Archive](#9-archive).

The unit of specification is a **requirement with at least one scenario**:

```markdown
### Requirement: Session timeout
Sessions SHALL expire after 30 minutes of inactivity.

#### Scenario: Idle session expires
- **WHEN** a session is idle for 30 minutes
- **THEN** the next request is rejected with 401
```

A scenario is a test you have not written yet. If you cannot phrase one as an observable WHEN/THEN, the requirement is not specified yet — it is a wish.

Two rules that bite:

- **A `MODIFIED` requirement restates the requirement in full** — the text and every surviving scenario. A partial restatement silently deletes whatever you left out, and the validator will reject a modification that drops a scenario the canonical spec still has. Adding a new concern to an unchanged requirement is `ADDED`, not `MODIFIED`.
- **Renaming a requirement is a `RENAMED` operation**, never a quiet edit of the header. Everything downstream — tasks, tests, review — joins on that name.

Read `references/artifacts.md` for the exact grammar, the four delta operations, and the error list.

**Done when** every capability named in the proposal has a delta, every requirement has at least one scenario, and `validate.mjs` reports no errors.

> **GATE — the user approves the specs before you plan work.** This is the last cheap moment to change your mind.

### 5. Design

Write `docs/eagle-sdd/plans/<change-id>/design.md` **only if** the change crosses module boundaries, adds a dependency, alters a data model, or carries migration or security risk. Otherwise skip it and say that you skipped it.

Design records decisions with their alternatives and their risks. It does not restate the spec — link to it.

**Done when** either `design.md` exists with its decisions resolved, or you have stated why it does not.

### 6. Plan

Write `docs/eagle-sdd/plans/<change-id>/tasks.md`. Each task is one independently verifiable work item with an observable acceptance criterion:

```markdown
- [ ] 2.1 Add expiry check to the session middleware
      Covers: Session timeout
      Depends: 1.2
      Verify: `pnpm test session-expiry` passes with the new case
```

The three tags are not decoration:

- `Covers:` joins the task to a requirement **by its exact name**. Every requirement must be covered by at least one task. This is what stops the proposal from being a write-only document — without it, nothing checks that what you promised to specify ever became work.
- `Depends:` joins tasks into a graph. It must resolve, and it must not cycle.
- `Verify:` states the command or observation that settles the task.

Order tasks so that dependencies come first and each task is small enough to finish and verify in one sitting.

**Done when** every requirement is covered, every dependency resolves, the graph is acyclic, and `validate.mjs` reports no errors.

### 7. Implement

Work the tasks in order. For each one: make the change, run its `Verify:` check, read the output, then tick the box.

Tick the box **after** you have read the verification output, never before. A tick is a claim, and rule 2 applies to it.

If a task turns out to be wrong — the requirement was misread, the approach does not work — stop and go back. Fix the spec first, then the tasks, then the code. Editing code to match a spec you no longer believe is how drift starts.

**Done when** every box is ticked and every `Verify:` check has been run and read in this session.

### 8. Verify

Read `references/verification.md` and run its gate. Verification asks a different question from "do the tests pass": it asks **does the code do what the spec says**, requirement by requirement.

Walk the delta specs requirement by requirement. For each one, name the evidence — the test, the command, the observation — and say whether you produced it in this session. Requirements with no evidence are not verified, however green the suite is.

Dispatched work is verified by a fresh reviewer with no memory of writing it. A worker reporting success is not evidence; it is a claim to be checked.

**Done when** every requirement in the delta maps to evidence you ran and read, and any gap is reported to the user as a gap rather than smoothed over.

### 9. Archive

Only after verification passes.

Merge the deltas into `docs/eagle-sdd/specs/` in this fixed order, matching requirements by normalized header name:

**RENAMED → REMOVED → MODIFIED → ADDED**

The order is not arbitrary: renaming first means later operations resolve against final names, and removing before adding means a replacement requirement never collides with the one it replaces. Applied in this order the merge is idempotent, so re-running it cannot corrupt the spec.

Then move the plan to `docs/eagle-sdd/plans/archive/<change-id>/`. Keep it — it is the record of why the spec says what it says.

**Done when** the canonical specs reflect every delta, the plan is archived, and `validate.mjs` reports no errors across the whole tree.

## When you feel the pull to skip

These are the thoughts that precede a broken spec. Each one is a signal, not a reason.

| The thought | What is actually true |
|---|---|
| "This is simple enough to skip the spec" | Simple changes are where drift starts unnoticed. If it is truly mechanical, the scope check already routed you out. |
| "I'll write the spec after, once I know the shape" | A spec written after the code describes the code, bugs included. It cannot tell you what you should have built. |
| "The tests pass, so it's verified" | Tests answer "does it work". The spec answers "is this the thing we agreed to build". They are different questions. |
| "I already ran that check earlier" | Prior runs are not evidence. State is not preserved between then and now. Run it again. |
| "The subagent said it was done" | A success report is a claim. Go and check the artifact. |
| "The user is waiting, I'll confirm the spec later" | An unapproved spec is a guess. You will build the wrong thing faster. |
| "This requirement is obvious, it needs no scenario" | Then writing the WHEN/THEN takes twenty seconds, and it is the only thing that makes it testable. |
| "I'll clean up the delta wording at archive time" | Archive is a merge, not an edit. Restate it fully now. |

## Red flags — stop and fix the spec

- You are editing source files and no delta spec exists for the behavior you are changing.
- You are about to tick a checkbox you have not verified in this session.
- A `MODIFIED` requirement does not restate the requirement in full.
- A requirement header was renamed without a `RENAMED` operation.
- A requirement exists that no task covers.
- You are asking the user a question in prose that you could have asked with options.
- You are explaining to yourself why this particular change is the exception.

## Reference

| File | Load it when |
|---|---|
| `references/artifacts.md` | Writing or validating any artifact — the grammar, the four delta operations, the error list |
| `references/verification.md` | Step 8, or any time you are about to claim something works |
| `references/harnesses.md` | You need to translate an action in this skill into the tool your environment actually provides |
| `assets/templates/` | Starting any artifact — copy the template rather than inventing a shape |
| `scripts/validate.mjs` | After steps 3, 4, 6, and 9 — `node scripts/validate.mjs` |

Layout this workflow owns:

```
docs/eagle-sdd/
├── specs/<capability>/spec.md          # canonical truth — only Archive writes here
└── plans/
    ├── <change-id>/                    # one change in flight
    │   ├── proposal.md
    │   ├── design.md                   # only when step 5 applies
    │   ├── tasks.md
    │   └── specs/<capability>/spec.md  # deltas — what this change alters
    └── archive/<change-id>/            # merged changes, kept as the record
```
