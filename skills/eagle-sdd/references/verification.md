# Verification

Step 8 of the workflow. Load this file any time you are about to claim that something works.

Verification asks a question that tests cannot answer: **does the code do what the spec says it does?** A green suite means the tests you have agree with the code you wrote. It says nothing about whether either one matches what was agreed.

## The gate

Five steps, in order. You may not skip one, and you may not compress them.

| Step | Do |
|---|---|
| **IDENTIFY** | Name the requirement and the exact check that settles it. |
| **RUN** | Execute it now, in this session. |
| **READ** | Read the full output, including the exit code. |
| **VERIFY** | Confirm the output actually establishes what you claimed it would. |
| **CLAIM** | Only now may you report the requirement as verified, and you report what the check said. |

**Violating the letter of these steps is violating their spirit.** There is no reading of step 2 under which a check you ran before this conversation started counts as running it now.

## What is not evidence

| Not evidence | Why |
|---|---|
| A run from an earlier session or earlier in this conversation | State is not preserved. The code changed since. |
| "The tests pass" without the output in front of you | That is a memory of a claim, not an observation. |
| A subagent's success report | A claim. Go and read the artifact it says it produced. |
| The linter passed, so the build must pass | Two different checks. The build is one command away. |
| The code reads correctly | Reading is not running. |
| A partial run that was interrupted | An incomplete check has no verdict. |
| "It worked on my machine before the last edit" | The last edit is exactly what is in question. |

## Walk the design

A passing suite is not a verified change. Walk the design document section by section and account
for every part of it.

```markdown
## Verification report — 2026-08-04-store-search-layout

| Part of the design | Evidence | Result | Fresh |
|---|---|---|---|
| §4.1 Card header buttons | manual check, admin page | pass | yes |
| §4.2 Search row layout | `pnpm test store-layout` | pass, 4 cases | yes |
| §4.3 Collapse behaviour | manual check, narrow viewport | pass | yes |
| §1 Indented audit log | — | **no evidence** | — |

Unverified: §1's audit-log line. No test or observation covers it. Reported to user.
```

Two habits make this table honest:

- **`Fresh` is a separate column from `Result`.** A pass you did not produce in this session is
  not a pass. Marking it `no` is the point of the table.
- **An unverified part stays visible.** Fill the gap or report it. Do not delete the row, and do
  not soften the wording.

If a part of the design has no possible check, that is a defect in the design document. Say so —
something that cannot be observed was never testable, and it should not have passed the gate at
step 3.

## When work was delegated

A worker verifying its own output is one seat pretending to be two. If any part of the change was implemented by a separate agent:

- **Dispatch a fresh reviewer.** It must not be the agent that wrote the code, and it must not inherit that agent's conversation. Give it the base and head revisions, the requirements it is checking, and nothing about how the work went.
- **Withhold the narrative.** Give the reviewer the diff and the spec sections. An implementer's account of what it did anchors the reviewer toward agreeing with it.
- **Forbid redundant heavy runs.** Tell the reviewer not to re-run expensive suites that already passed, and instead to reuse that evidence. Its job is spec compliance, not a second CI run.
- **Return separate verdicts.** One per axis, never a single summary judgement:

| Verdict | Question |
|---|---|
| **Spec compliance** | Does the change implement the requirement as written? |
| **Correctness** | Is the implementation free of defects? |
| **Consistency** | Does it follow the codebase's existing patterns? |

A change can pass correctness and fail spec compliance — that is the whole reason the axes are separate. Also ask the reviewer to classify each finding as `PASS`, `FAIL`, or `PRE-EXISTING`, so a defect that predates this change is not counted against it.

## When review does not converge

Do not cap rounds with a fixed number. A count is a proxy for a judgement you are capable of making directly. Stop and escalate to the user when you observe any of these, and say which one you observed:

- The same finding returns after a fix that was supposed to address it.
- Successive rounds produce different findings on the same part of the design.
- A finding cannot be resolved without changing the design document.
- The change has grown past what the design describes.

Report the impasse with its evidence and let the user decide. Parking a change with a recorded reason is a legitimate outcome. Looping is not.

## Before you say "done"

- [ ] Every part of the design document has evidence produced in this session.
- [ ] Every `Run:`/`Expected:` and `Verify:` step in the plan has been run and its output read.
- [ ] Every checkbox that is ticked was ticked after reading its verification output.
- [ ] `## 5. Out of scope` held — nothing outside it changed.
- [ ] Delegated work was reviewed by an agent that did not write it.
- [ ] Spec compliance and correctness are reported separately.
- [ ] Unverified parts are stated as gaps, in the report, in plain language.
- [ ] `node scripts/validate.mjs` exits `0`.

If any box is unticked, the change is not done. Say what is missing instead of reporting success.
