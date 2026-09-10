# Add the Summarize step Design

Date: 2026-09-10
Module: the workflow spine (`skills/eagle-sdd/SKILL.md`)
Project: eagle-sdd

## 1. Requirement summary

The workflow went from the grill straight into writing the design document. The first time the
user saw the decisions assembled into a coherent whole was inside a document that freezes on
approval — the most expensive possible place to notice that their requirement had been misread.

This adds a step between the two: state back, in plain language, what was understood and how it
will be solved, and let the user question it until they agree. Then write the design.

## 2. Confirmed decisions

| Question | Decision |
|---|---|
| What the step is called | `Summarize` — a verb, matching Orient / Grill / Design / Plan, and the user's own word for it |
| Does it produce a file | No. A message and a conversation. Nothing on disk until the user agrees |
| Level of detail | Plain language: no code, no file paths, no class names |
| Is it blocking | Yes. The design document is not written until the user confirms |
| One turn or many | Many, by design. The loop ends when the user confirms, not when the agent has spoken |
| How many gates now | Three. Each catches a different class of mistake, so they are not redundant |

Considered and rejected: writing the summary to disk as a third artifact (it is redundant the
moment the design document exists, and a file that goes stale immediately is worse than no file);
letting the grill's answers stand as implicit agreement (one decision at a time never shows the
user the whole picture, which is the thing being misread); folding the summary into the design
document's opening section (that is the document that freezes — the checkpoint has to come before
it, not inside it).

## 3. Current state and problem

Seven steps: Orient, Grill, Design document, Plan document, Implement, Verify, Close.

The grill settles decisions one at a time as structured questions. That is good at resolving
ambiguity and bad at showing a whole plan — the user answers five questions and never sees the
five answers together until the design document presents them, by which point the document is
written and one approval away from frozen.

There is therefore no cheap point at which "you have misunderstood what I want" can be said. The
grill is too granular; the design document is too heavy. The gap between them is exactly the width
of a paragraph of prose.

## 4. Detailed design

### 4.1 The step

`### 3. Summarize` is inserted between Grill and Design document. It requires six things, in
order:

1. The problem as understood, in the user's terms.
2. The approach in plain language — what changes, not how.
3. The decisions, each with the option it beat.
4. Out of scope, and what must not break.
5. Assumptions and open risks.
6. A direct closing question: anything wrong, missing, or needing clarification?

### 4.2 What it must not become

Three failure modes, stated in the step because each is a way the checkpoint quietly stops working:

- **Not a design document.** No code, no paths, no class names. A summary carrying the detailed
  design turns step 4 into a rubber stamp, which costs the workflow the gate step 4 exists for.
- **Not long.** If the summary is longer than the original request, it is not a summary.
- **Not an announcement.** It expects replies and answers them.

### 4.3 The loop

The step is multi-turn. If a reply changes a decision, the summary is revised and re-presented —
it is not patched into the design document later in the hope the user notices. It does not proceed
because the user went quiet; it ends its turn on the question and waits. "Just go ahead" is
recorded as a ruling like any other.

### 4.4 Renumbering

Design document 3→4, Plan 4→5, Implement 5→6, Verify 6→7, Close 7→8. Cross-references that move:
the step count in `SKILL.md` and `README.md`, the verify and validator references inside
`SKILL.md`, `references/verification.md`'s two step references, and the whole of `docs/WORKFLOW.md`
including its contents list, its gate markers and its worked transcript.

### 4.5 Gates

Two become three. The gates table gains a column naming the mistake each one catches, because
three blocking gates without that column reads as bureaucracy rather than as three different
checkpoints:

| After | Catches |
|---|---|
| Step 3, the summary | You are solving the wrong problem |
| Step 4, the design document | The right problem, solved the wrong way |
| Step 5, the plan document | The right solution, decomposed badly |

## 5. Out of scope

The two document types and their grammar are unchanged, and the validator gains no codes — this
step writes no file, so there is nothing for it to check. No new template. The installer and the
plugin manifests are untouched.

## 6. How to verify

1. `node --test` — 33 cases pass, and `SKILL.md` is still under 500 lines.
2. `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd` — clean.
3. Search the skill and the docs for step references; none may point at the old numbering.
4. Read `docs/WORKFLOW.md` end to end. The new step must read as a step, and the worked transcript
   must show it catching something — a transcript where the summary changes nothing does not
   demonstrate the step earning its turn.
