# Cut the skill's token cost Design

Date: 2026-09-10
Module: the skill bundle (`skills/eagle-sdd/`)
Project: eagle-sdd

## 1. Requirement summary

The workflow was measured before anything was changed. Two questions: what does the skill cost, and
what can be cut without costing quality.

The measurement reframed the problem. The skill's own instructions are **~9.1k tokens per run** and
**53 tokens always resident** — neither is alarming. The documents it produces are: a real plan
document averages **~10k tokens**, and the largest pair in the reference repository is **~25k**, a
fifth of a 128k window. And a plan is read *back* during implementation, so its whole weight can
sit in context for the rest of the run.

So the change is two things: remove the instruction-level waste, and add the one rule that stops a
large plan from being loaded whole.

## 2. Confirmed decisions

| Question | Decision |
|---|---|
| Is the always-resident cost worth optimising | No. 53 tokens per turn is noise; the description stays as written |
| Optimise the skill files or the behaviour | Both, but they are not equal — the behavioural rule is worth an order of magnitude more than the file trims |
| Where the instruction-level waste is | Duplication, not length: the two documents' shapes were written out three times — in `SKILL.md`, in `plan-format.md`, and in the templates |
| Which copy survives | The templates. They are what the agent copies, so they are the single source of truth for shape; the reference points at them instead of reproducing them |
| Does the reference keep its rules | Yes. Only the worked examples go. Required fields, the pair rule and the checks all stay |
| Add a rule for reading a plan | Yes — one task at a time. It is the only change here with a large effect |
| Touch the discipline layer | No. The rationalisation table and the red flags stay |

Considered and rejected: trimming the rationalisation table (600 tokens, and it is the layer that
stops an agent talking itself past a gate); trimming the harness tool mapping (already loaded only
when a tool needs translating); abbreviating the description (18 tokens a turn, and it is the only
thing that decides whether the skill is found at all); compressing prose into denser notation
(saves tokens, costs the variance the plain wording was tuned for).

## 3. Current state and problem

Measured, before the change:

| | Chars | ~Tokens |
|---|---:|---:|
| description (always resident) | 211 | 53 |
| `SKILL.md` | 18,832 | 4,708 |
| `plan-format.md` | 7,453 | 1,863 |
| `verification.md` | 5,579 | 1,395 |
| two templates | 4,547 | 1,136 |
| `harnesses.md` (on demand) | 6,939 | 1,735 |
| **per-run load** | | **~9,103** |

Two problems.

**Duplication.** The shape of the design document was written out three times: the six-section
table in `SKILL.md`, a worked example in `plan-format.md`, and the template. The shape of the plan
document likewise. A document shape that lives in three places drifts in two of them.

**Step 6 said to work the tasks in order but never said how much of the plan to read.** A plan runs
long precisely because every step carries its code. Reading all of it to do task 1 holds all of it
in context for the rest of the run, and invites starting task 4 while task 2 is unverified. On the
largest real plan that is 21k tokens resident for no benefit.

## 4. Detailed design

### 4.1 Step 6 gains one rule

`**Read one task at a time, not the whole plan.**` Read the task you are about to do, do it, read
the next one when you get there. This is the only change here that moves a five-figure number.

### 4.2 The worked examples leave `plan-format.md`

Both sections now open with "Copy `assets/templates/<name>.md`" and describe the shape in one
sentence, rather than reproducing it. The rules that follow are unchanged: required fields, what
each header line is worth, the task requirements, the pair rule, the checks.

### 4.3 `SKILL.md` states the shapes once

The six-section table in step 4 and the four-header-line descriptions in step 5 collapse to the
names, with a pointer to the template and the reference for what belongs in each and which fields
are enforced.

### 4.4 What was deliberately left alone

The rationalisation table, the red flags, the four-rule contract, the scope check, the gate table,
and the evidence gate. These are the parts that change behaviour rather than describe shape.

## 5. Out of scope

The document grammar, the twelve validator codes, the templates' contents, the installer, and the
plugin manifests. No behaviour changes other than the read-one-task rule.

## 6. How to verify

1. `node --test` — 36 cases pass, including the symlink regression test.
2. `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd` — clean.
3. Measure before and after and report the real number, including if it is smaller than estimated.
4. Confirm the templates are still referenced from the reference, and that both exist.
5. Confirm `SKILL.md` is still under 500 lines.
