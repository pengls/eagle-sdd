# Superpowers + the Agent Skills format — primary-source research note

Researched 2026-09-10. Primary sources: `obra/superpowers` at `main` (tree SHA
`b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, plugin v6.3.0, read from
`https://codeload.github.com/obra/superpowers/tar.gz/refs/heads/main`), Anthropic's Claude Code
skills docs, the Agent Skills specification, and the Anthropic engineering blog.
`raw.githubusercontent.com` is DNS-blocked here, so every quote is verbatim from the tarball/API
snapshot at that commit. Inferences are marked `[inference]`; every claim carries a URL.

## Summary

- **Superpowers is not a novel format** — 14 plain `SKILL.md` files written to the *Agent Skills*
  open standard, plus **one bootstrap hook** that forces the agent to read them. It ships
  `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.devin-plugin/`, `.hermes-plugin/`,
  `.kimi-plugin/`, `.opencode/`, `.pi/`, `.agents/`, `gemini-extension.json` and `hooks/`, all
  pointing at the **same unmodified `skills/` tree**.
- The method is **skills-as-behaviour-shaping-code**: a spec/plan → implement → verify pipeline built
  from *process* skills (brainstorming, writing-plans, subagent-driven-development,
  verification-before-completion) that dispatch *technique* skills (TDD, systematic-debugging).
- **Two ideas worth stealing that are not skills**: (1) a **SessionStart hook that injects the full
  `using-superpowers` skill body** on `startup|clear|compact` — the `description` field alone is not a
  reliable trigger; (2) an **append-only ledger + plan-scoped scratch workspace** that survives
  compaction, so a controller cannot re-dispatch completed work.
- `writing-skills` is **TDD applied to documentation**, with one genuinely novel rule: the
  `description` must **never summarize the skill's workflow**, because agents then follow the
  description instead of reading the body.
- Portability is bounded by one hard requirement: the harness must inject context at session start
  with **no per-session opt-in**.

## The Agent Skills format

### Layout

[agentskills.io/specification](https://agentskills.io/specification): a skill is a directory
containing at minimum `SKILL.md`, plus optional `scripts/`, `references/`, `assets/`. Superpowers
narrows this to a flat namespace where only two reasons justify a second file
([`skills/writing-skills/SKILL.md`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)):

> **Flat namespace** - all skills in one searchable namespace
>
> **Separate files for:** 1. **Heavy reference** (100+ lines) - API docs, comprehensive syntax.
> 2. **Reusable tools** - Scripts, utilities, templates.
>
> **Keep inline:** Principles and concepts / Code patterns (< 50 lines) / Everything else

### Frontmatter

Standard fields ([spec](https://agentskills.io/specification)):

| Field | Required | Constraints |
| --- | --- | --- |
| `name` | Yes | Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen. |
| `description` | Yes | Max 1024 characters. Non-empty. Describes what the skill does and when to use it. |
| `license` | No | License name or reference to a bundled license file. |
| `compatibility` | No | Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.). |
| `metadata` | No | Arbitrary key-value mapping for additional metadata (a map from string keys to string values). |
| `allowed-tools` | No | Space-separated string of pre-approved tools the skill may use. (Experimental) |

More `name` rules, verbatim: *"Must be 1-64 characters"*, *"May only contain unicode lowercase
alphanumeric characters (`a-z`, `0-9`) and hyphens (`-`)"*, *"Must not start or end with a hyphen"*,
*"Must not contain consecutive hyphens (`--`)"*, *"Must match the parent directory name"*.

**Claude Code extensions** ([docs](https://code.claude.com/docs/en/skills)) that matter:
`when_to_use` (appended to `description`; the combined text is **truncated at 1,536 characters** in
the skill listing); `allowed-tools` (*"Tools Claude can use without asking permission **during the
turn that invokes this skill**. The grant clears when you send your next message."*);
`disable-model-invocation: true`; `user-invocable: false`; `paths` (glob gate); `model` / `effort`;
`context: fork` + `agent` (run the skill body as a forked subagent's prompt); `hooks`;
`argument-hint`; `arguments`; `metadata` / `license` / `compatibility` (accepted, not acted on).

**The portable subset is 6 fields**: `name`, `description`, `license`, `compatibility`, `metadata`,
`allowed-tools`. Unknown keys are rejected — `Unexpected key(s) in SKILL.md frontmatter:
argument-hint. Allowed properties are: allowed-tools, compatibility, description, license, metadata,
name` — and claude.ai uploads, the Skills API and `package_skill.py` accept only those six.

`[inference]` Superpowers uses almost no Claude Code extensions: all 14 skills have exactly two keys,
`name` and `description` (`brainstorming` quotes its description). That is what lets the same files
run unchanged on nine harnesses. *Discrepancy to note:* Superpowers' meta-skill says frontmatter is
*"Max 1024 characters total"*, while the spec makes 1024 the `description` limit and caps `name` at
64 — Superpowers' line is the older/stricter reading.

### Size and format constraints

- **Progressive disclosure, three levels** ([Anthropic engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)):
  (1) **metadata** — every skill's `name` + `description` pre-loaded at startup (~100 tokens);
  (2) **instructions** — the full `SKILL.md` body, loaded when the skill activates (< 5000 tokens
  recommended); (3) **resources** — `scripts/`, `references/`, `assets/`, loaded only as required.
- *"Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files."*
  ([spec](https://agentskills.io/specification)); also *"Keep file references one level deep from
  `SKILL.md`. Avoid deeply nested reference chains."*
- Superpowers' tighter budget for frequently-loaded skills:

```
Target word counts:
- getting-started workflows: <150 words each
- Frequently-loaded skills: <200 words total
- Other skills: <500 words (still be concise)
Verification: wc -w skills/path/SKILL.md
```

- And its anti-`@` rule: *"**Why no @ links:** `@` syntax force-loads files immediately, consuming
  200k+ context before you need them."*

## Discovery and loading mechanism

Per the Anthropic blog the sequence is: context holds the system prompt + every skill's metadata +
the user's message → the model invokes a tool to read `<skill>/SKILL.md` → it may read a bundled file
→ it proceeds. Three things drive invocation:

1. **`description` is the whole selection signal** — *"Claude uses this to decide when to apply the
   skill"* ([docs](https://code.claude.com/docs/en/skills)). With 100+ skills installed it competes
   inside the 1,536-characters-per-skill listing budget.
2. **Supporting files are referenced by relative path** from the skill root. Claude Code substitutes
   `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` in the body *and* in
   `allowed-tools` Bash rules, so `Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)` runs a bundled
   script unprompted.
3. **Dynamic context injection** (Claude Code only): `` !`cmd` `` at line start, or a ```` ```! ````
   fenced block, runs a shell command *before* the content reaches the model; a non-zero exit aborts
   the whole invocation.

**Load locations**: enterprise, personal (`~/.claude/skills/`), project (`.claude/skills/`), nested
subdirectories, `--add-dir` directories, and plugins (`<plugin>/skills/<name>/SKILL.md` →
`/plugin-name:skill-name`). Collisions resolve enterprise > personal > project; a skill beats a legacy
`.claude/commands/` file; plugin skills are namespaced so both coexist.

### The Superpowers twist: metadata is not enough

Superpowers does not trust the description to trigger its process — it injects the whole bootstrap at
session start ([`hooks/hooks.json`](https://github.com/obra/superpowers/blob/main/hooks/hooks.json)):

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "startup|clear|compact",
        "hooks": [ { "type": "command",
                     "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
                     "shell": "bash", "async": false } ] }
    ]
  }
}
```

The matcher includes **`compact`** — the bootstrap is re-injected after every compaction. That is
Superpowers' answer to context rot. `hooks/session-start` cats `skills/using-superpowers/SKILL.md` and
emits it wrapped as `<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of
your 'superpowers:using-superpowers' skill … For all other skills, use the 'Skill' tool:**\n\n…`.

`[inference]` This is the highest-leverage mechanism in the repo; the porting guide states it
outright: *"**The bootstrap is the entire integration.** Without it, the skill files are inert —
present on disk, never invoked."*

The injected bootstrap ([`using-superpowers/SKILL.md`](https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md)):

```markdown
## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. …
```

It also carries a `<SUBAGENT-STOP>` guard (*"If you were dispatched as a subagent to execute a
specific task, ignore this skill."*) and an instruction-precedence rule: *"User instructions
(CLAUDE.md, AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn
override default behavior."*

## Superpowers skill inventory and composition

14 skills under `skills/`; all have exactly two frontmatter keys.

| Skill | `description` (verbatim) | Class |
| --- | --- | --- |
| `using-superpowers` | Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions | meta / bootstrap |
| `brainstorming` | "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation." | **process** (spec) |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code | **process** (plan) |
| `executing-plans` | Use when you have a written implementation plan to execute in a separate session with review checkpoints | **process** (execute) |
| `subagent-driven-development` | Use when executing implementation plans with independent tasks in the current session | **process** (execute) |
| `dispatching-parallel-agents` | Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies | **process** (execute) |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code | process → **technique** |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes | process → **technique** |
| `verification-before-completion` | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always | **process** (discipline) |
| `requesting-code-review` | Use when completing tasks, implementing major features, or before merging to verify work meets requirements | **process** (review) |
| `receiving-code-review` | Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation | **process** (discipline) |
| `using-git-worktrees` | Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback | **technique** (environment) |
| `finishing-a-development-branch` | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work | **process** (handoff) |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before deployment | **meta** |

README grouping ([README.md](https://github.com/obra/superpowers/blob/main/README.md)): Testing
(TDD); Debugging (systematic-debugging, verification-before-completion); Collaboration (brainstorming,
writing-plans, executing-plans, dispatching-parallel-agents, requesting/receiving-code-review,
using-git-worktrees, finishing-a-development-branch, subagent-driven-development); Meta
(writing-skills, using-superpowers).

### The composed workflow

> 1. **brainstorming** - Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation. Saves design document.
> 2. **using-git-worktrees** - Activates after design approval. Creates isolated workspace on new branch, runs project setup, verifies clean test baseline.
> 3. **writing-plans** - Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps.
> 4. **subagent-driven-development** or **executing-plans** - Activates with plan. Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality), or executes in batches with human checkpoints.
> 5. **test-driven-development** - Activates during implementation. Enforces RED-GREEN-REFACTOR: write failing test, watch it fail, write minimal code, watch it pass, commit. Deletes code written before tests.
> 6. **requesting-code-review** - Activates between tasks. Reviews against plan, reports issues by severity. Critical issues block progress.
> 7. **finishing-a-development-branch** - Activates when tasks complete. Verifies tests, presents options (merge/PR/keep/discard), cleans up worktree.
>
> **The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

The chain is explicit at every hand-off: `brainstorming`'s architectural path ends *"Invoke the
writing-plans skill … Do NOT invoke any other skill. writing-plans is the next step."*;
`writing-plans` ends with a mandatory **Execution Handoff** offering exactly two options
(Subagent-Driven, recommended; Inline Execution), each naming a `REQUIRED SUB-SKILL`; both executors
terminate in `superpowers:finishing-a-development-branch`.

Superpowers' own taxonomy — **technique / pattern / reference** — is orthogonal to process vs content:
*"**Technique** Concrete method with steps to follow (condition-based-waiting, root-cause-tracing) /
**Pattern** Way of thinking about problems / **Reference** API docs, syntax guides, tool
documentation."* Discipline-enforcing skills are a fourth class in practice, and `writing-skills`
says they need different tests.

## The skill-authoring meta-rules (verbatim)

The most valuable artifact is
[`skills/writing-skills/SKILL.md`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)
(679 lines). It venders Anthropic's official guidance as `anthropic-best-practices.md` (1,150 lines),
published as [agentskills.io/skill-creation/best-practices](https://agentskills.io/skill-creation/best-practices).

### Skills are TDD applied to documentation

> **Writing skills IS Test-Driven Development applied to process documentation.**
>
> You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).
>
> **Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

The mapping: **test case** = pressure scenario with a subagent; **production code** = the SKILL.md;
**RED** = agent violates the rule without the skill (baseline); **GREEN** = agent complies with the
skill present; **refactor** = close loopholes while maintaining compliance.

```
## The Iron Law (Same as TDD)

NO SKILL WITHOUT A FAILING TEST FIRST

This applies to NEW skills AND EDITS to existing skills.
Write skill before testing? Delete it. Start over.
Edit skill without testing? Same violation.

No exceptions:
- Not for "simple additions" / "just adding a section" / "documentation updates"
- Don't keep untested changes as "reference"
- Don't "adapt" while running tests
- Delete means delete
```

### Skill Discovery Optimization — the description rules

```
CRITICAL: Description = When to Use, NOT What the Skill Does

The description should ONLY describe triggering conditions. Do NOT summarize the skill's process or workflow in the description.

Why this matters: Testing revealed that when a description summarizes the skill's workflow, an agent may follow the description instead of reading the full skill content. A description saying "code review between tasks" caused an agent to do ONE review, even though the skill's flowchart clearly showed TWO reviews (spec compliance then code quality).

When the description was changed to just "Use when executing implementation plans with independent tasks" (no workflow summary), the agent correctly read the flowchart and followed the two-stage review process.

The trap: Descriptions that summarize workflow create a shortcut agents will take. The skill body becomes documentation agents skip.
```

```yaml
# ❌ BAD: Summarizes workflow - agents may follow this instead of reading skill
description: Use when executing plans - dispatches subagent per task with code review between tasks

# ❌ BAD: Too much process detail
description: Use for TDD - write test first, watch it fail, write minimal code, refactor

# ✅ GOOD: Just triggering conditions, no workflow summary
description: Use when executing implementation plans with independent tasks in the current session

# ✅ GOOD: Triggering conditions only
description: Use when implementing any feature or bugfix, before writing implementation code
```

Other SDO rules: keyword coverage (error strings, symptoms, synonyms, real command names);
**verb-first/gerund naming** (*"✅ `creating-skills` not `skill-creation`"*, *"✅
`condition-based-waiting` not `async-test-helpers`"*); third person, because the description is
injected into a system prompt. Cross-references use the skill name with an explicit requirement marker
— *"✅ Good: `**REQUIRED SUB-SKILL:** Use superpowers:test-driven-development`"*, *"❌ Bad:
`@skills/testing/test-driven-development/SKILL.md` (force-loads, burns context)"*.

### Match the form to the failure type

```
| Baseline failure | Right form | Wrong form |
|---|---|---|
| Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red flags | Soft guidance ("prefer...", "consider...") |
| Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output IS — its parts, in order | Prohibition list ("don't restate", "never narrate") |
| Omits a required element from something they already produce | Structural: REQUIRED field or slot in the template they fill in | Prose reminders near the template |
| Behavior should depend on a condition | Conditional keyed to an observable predicate ("if the brief exists, reference it") | Unconditional rule + exemption clauses |

Why prohibitions backfire on shaping problems: under a competing incentive ("make the prompt self-contained"), agents negotiate with "don't X". In head-to-head wording tests on dispatch-prompt guidance, the prohibition arm produced clearly more of the unwanted content than the recipe arm (fully separated distributions), and trended worse than even the no-guidance control.

Rules for whichever form you pick:
- No nuance clauses. "Don't X unless it matters" reopens the negotiation — appending a single nuance clause to a winning recipe degraded it from consistent to noisy in the same wording tests. Express a real exception as its own conditional on an observable predicate.
- Exemption clauses don't scope. "This limit doesn't apply to code blocks" still suppresses code blocks. If part of the output must be exempt, restructure so the rule can't reach it.
```

**Bulletproofing discipline skills** — *"Scope: this toolkit is for discipline failures — an agent that
knows the rule and skips it under pressure."* Four techniques: close every loophole explicitly (*"Write
code before test? Delete it. Start over. **No exceptions:** Don't keep it as 'reference' / Don't
'adapt' it while writing tests / Don't look at it / Delete means delete"*); add the foundational
principle **"Violating the letter of the rules is violating the spirit of the rules."**; build a
**rationalization table** (Excuse → Reality) from the baseline transcripts; create a **Red Flags — STOP
and Start Over** list. Fifth: add the *symptom of about to violate the rule* to the description.

**Micro-testing wording before full scenarios** (verbatim): **1.** *"One fresh-context sample per
call"* — system prompt = the realistic context the guidance will live in, user message = a task that
tempts the failure. **2.** *"Always include a no-guidance control. If the control doesn't exhibit the
failure, there is nothing to fix — stop, don't author the guidance."* **3.** *"5+ reps per variant.
Single samples lie."* **4.** *"Manually read every flagged match"* — template echoes and quoted
counter-examples masquerade as hits. **5.** *"Variance is a metric. When guidance lands, reps converge
on the same shape. Five different interpretations across five reps means the wording isn't binding —
tighten the form before adding words."*

The contributor guide makes this a merge gate — *"Skills are not prose — they are code that shapes
agent behavior"* — and refuses PRs that restructure skills to "comply" with Anthropic's published
guidance without eval evidence ([CLAUDE.md](https://github.com/obra/superpowers/blob/main/CLAUDE.md)).

## Reusable techniques for spec-driven development

**1. Classify the request, then gate on approval.** `brainstorming` forces every request into
**Spike** / **Bounded** / **Architectural** out loud; the class picks the artifact (nothing / a few
sentences in chat / a written spec) but never the gate:

```
<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have told your human partner what you intend and they have approved it. This applies to EVERY task on EVERY path below — the ceremony scales with the task; the approval gate never does.
</HARD-GATE>

When in doubt between two paths, take the heavier one. The ratchet is one-way: hidden complexity discovered mid-task upgrades the path — stop, say so, and step up. Nothing downgrades mid-task.
```

**2. Spec and plan are separate artifacts with a stated authority order.** `brainstorming` writes
`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`; `writing-plans` writes
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. The plan links back to the spec, and the executor is
told *"the spec is the binding authority, the plan is its argument, and your judgment settles what
neither answers."*

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Spec:** [path to the spec/design doc this plan implements — the plan argues from the spec, so the spec travels with it; executors read both]

## Global Constraints

[The spec's project-wide requirements — version floors, dependency limits, naming and copy rules, platform requirements — one line each, with exact values copied verbatim from the spec. Every task's requirements implicitly include this section.]
```

**3. Task blocks carry exact files, exact interfaces, and real code.** Each task lists `Files:`
(Create/Modify/Test with paths and line ranges) and `Interfaces:` — *"Consumes: [what this task uses
from earlier tasks — exact signatures] / Produces: [what later tasks rely on …] A task's implementer
sees only their own task; this block is how they learn the names and types neighboring tasks use."*
Steps run 2-5 minutes and embed complete code; these are plan failures: *"TBD", "TODO", "implement
later"*; *"Add appropriate error handling" / "add validation"*; *"Write tests for the above"* (without
actual test code); *"Similar to Task N"* (repeat the code); steps that describe without showing how;
references to types, functions, or methods defined in no task.

**4. Dispatch each task from a file, never from the controller's context.**
`scripts/task-brief PLAN_FILE N` is a 40-line `awk` script extracting one task into
`<repo-root>/.superpowers/sdd/<plan-basename>/task-N-brief.md`. The dispatch prompt holds only: one
line on where the task fits; the brief path introduced as *"read this first — it is your
requirements, with the exact values to use verbatim"*; interfaces from earlier tasks; the controller's
resolution of ambiguity; and the report-file path and contract. Rationale is measured: *"a real
session's dispatch hit 42k chars of which 99% was pasted history."* The implementer writes a full
report to its report file and returns **under 15 lines**: status (`DONE` / `DONE_WITH_CONCERNS` /
`BLOCKED` / `NEEDS_CONTEXT`), commits, a one-line test summary, concerns, report path.

**5. Two verdicts from one reviewer, both required.** `task-reviewer-prompt.md` returns **Part 1: Spec
Compliance** (Missing / Extra / Misunderstood, with file:line) and **Part 2: Code Quality**, plus a
`⚠️ Cannot verify from diff` list the controller must resolve. The reviewer is told *"Do Not Trust the
Report … a stated rationale never downgrades a finding's severity"*, *"Do not re-run the suite to
confirm their report"* (the implementer's report **is** the test evidence), and *"Acknowledge what was
done well before listing issues — accurate praise helps the implementer trust the rest of the
feedback."* The whole-branch review is a separate, single, most-capable-model dispatch.

**6. A ledger file as durable memory, plus a decision policy that avoids stalls.** *"Conversation
memory does not survive compaction. In real sessions, controllers that lost their place have
re-dispatched entire completed task sequences — the single most expensive failure observed."*
`progress.md` lives in a **per-plan git-ignored workspace** (`scripts/sdd-workspace` prints
`<repo-root>/.superpowers/sdd/<plan-slug>/` and writes a self-ignoring `.gitignore` containing `*`);
its first line is an identity marker (`# SDD ledger — plan: <plan file path>`) so a stale ledger
cannot be mistaken for the current one; every fix round, completion, parked finding and ruling is one
append-only line. *"After compaction, trust the ledger and `git log` over your own recollection."*
Paired with:

> **Rulings, not stalls.** A running plan does not wait on a human. Conflicts, ambiguities, plan defects, a cap you would have asked to exceed — decide them. … Record every decision in the ledger as `Ruling: <what you decided> — <why> — <what it costs if wrong>`, and keep going. A wrong ruling costs rework your human partner can see and undo; a session parked on a question costs their whole day and buys nothing.
>
> Four things stop you, and only these: an irreversible or destructive operation; a security-sensitive action; a side effect outside this worktree that norms say you ask about first (a merge, a push to a shared branch, a publish); and a plan so broken that every path forward is a guess.

Every `Ruling:` line is collected into the final message — *"A ruling that dies with the workspace was
a decision made in secret."*

**7. A bounded fix loop with an escalation ladder and a breaker.** Fix rounds cap at 5 per task.
Rounds 1-3 **resume the original implementer** (its context is intact); rounds 4-5 dispatch a **fresh
implementer on a more capable model** carrying the brief, the report file, and *"A prior implementer
attempted this task [N] times; you own it now."* Every round ends with a **scoped re-review** over only
the fix diff (`review-package PLAN_FILE FIX_BASE HEAD`), never a fresh full review. At the cap the
controller adjudicates each open finding and ledgers a ruling — nothing is silently discarded. Minor
findings never enter the loop; they accumulate in the ledger for the final review to triage.

**8. Workers may not spawn workers; verification is a gate function.** Both the implementer and
reviewer prompts carry a `## You Do Not Dispatch Subagents` section — *"In real sessions, every
reviewer a worker spawned duplicated the task review the controller dispatched anyway — a full extra
review seat per task."* Nothing is claimed complete without fresh evidence:

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

The Iron Law is `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`, backed by a claim→evidence
table (*"Agent completed | VCS diff shows changes | Agent reports 'success'"*) and the rule that the
controller never fixes findings itself — *"Never fix findings yourself in the controller session —
your context stays clean for coordination, and controller fixes skip review."*

**9. Model routing per role, always explicit; batching and waiting discipline.** *"Always specify the
model explicitly when dispatching a subagent. An omitted model inherits your session's model — often
the most capable and most expensive — which silently defeats this section."* Plus *"Turn count beats
token price. Wall-clock and context cost scale with how many turns a subagent takes, and the cheapest
models routinely take 2-3× the turns on multi-step work."* Small identical edits go to one subagent
reviewed as a unit; independent failures go out in parallel in a single response (*"Multiple dispatch
calls in one response = parallel execution. One per response = sequential."*); never short-poll (*"In
measured sessions, roughly two-thirds of all wait calls were short polls that timed out."*). Before
Task 1, a pre-flight scan of the whole plan produces a **table** of task-pair interface conflicts and
per-task self-consistency — *"'The scan is clean' without those rows is not a scan you ran."*

## Portability across tools

### What is portable

From [`docs/porting-to-a-new-harness.md`](https://github.com/obra/superpowers/blob/main/docs/porting-to-a-new-harness.md):

> 1. **Skills (harness-agnostic).** Everything in `skills/` is the source of truth, shared verbatim by every harness. Skills are written to describe *actions* — "invoke a skill", "read a file", "dispatch a subagent", "create a todo" — and never name a specific tool. …
> 2. **Tool mapping (per-harness).** … lives in `skills/using-superpowers/references/<harness>-tools.md` and/or inline in the harness's bootstrap injector. It says, e.g., "*dispatch a subagent* → call `task` with `subagent_type`."
> 3. **Bootstrap (per-harness).** At the start of every session, the full `skills/using-superpowers/SKILL.md` is injected into the model's context, wrapped in `<EXTREMELY_IMPORTANT>` tags, with the tool mapping appended.

Two hard rules: *"**1. Skills name actions, not tools.** Do **not** edit skill bodies to fit your
harness."* and *"**2. Everything ships through the harness's own install mechanism. Never edit the
user's files.**"*

**The one non-negotiable capability**: *"The harness must let you inject text into the model's context
**at the start of every session, with no per-session opt-in** … If the only way to get Superpowers in
front of the model is for your human partner to opt in each session … the harness **cannot** be
properly supported."* The acceptance test is one prompt in a clean session — `Let's make a react todo
list` — which must auto-trigger `brainstorming` *before any code is written*.

Three integration shapes:

- **Shape A — shell hook** (Claude Code, Cursor, Copilot CLI): a configured command prints JSON whose
  field name differs per harness. `hooks/session-start` handles all three — Cursor wants
  `additional_context`, Claude Code wants `hookSpecificOutput.additionalContext`, Copilot/unknown wants
  top-level `additionalContext`.
- **Shape B — in-process plugin** (OpenCode `.opencode/plugins/superpowers.js`, pi
  `.pi/extensions/superpowers.ts`): register the skills directory through the host API, then inject the
  bootstrap by **mutating the message array** (deliberately a *user* message, not a system one).
- **Shape C — instructions file** (Gemini `contextFileName` → the extension's own `GEMINI.md` with
  `@`-includes; Antigravity via its plugin installer).

Adapters shipped at this commit: Claude Code, Codex (app + CLI), Cursor, Copilot CLI, Gemini CLI, Kimi
Code, OpenCode, pi, Hermes Agent, Antigravity, Devin CLI, Factory Droid, Grok Build CLI. Codex uses
**native skill discovery and no session-start hook** — it declares an empty `hooks` object precisely to
suppress auto-discovery of `hooks/hooks.json`; Kimi Code uses `sessionStart.skill` in its manifest.
Manifest divergence is visible directly: `.cursor-plugin/plugin.json` declares `"skills": "./skills/"`
and `"hooks": "./hooks/hooks-cursor.json"`, while `.claude-plugin/plugin.json` declares neither,
because Claude Code auto-discovers `skills/` and `hooks/hooks.json` **by convention**.

### AGENTS.md vs CLAUDE.md

- In the Superpowers repo, **`AGENTS.md` is a symlink to `CLAUDE.md`** (mode `120000`, 9 bytes of
  target). One file, two conventions.
- `~/.agents/skills/` is a **cross-runtime skill alias** recognized by Codex, Copilot CLI and Gemini
  CLI; per `references/gemini-tools.md`, *"When both directories exist at the same scope,
  `.agents/skills/` takes precedence."*
- Skills never name a single instruction file. The project spec
  `2026-05-05-platform-neutral-config-refs-design.md` records the rule: use *"a generic phrase rather
  than picking one filename. Different harnesses read different files (CLAUDE.md, AGENTS.md,
  GEMINI.md, etc.) and the skill should not assume one."* The per-platform filename lives only in each
  `references/<harness>-tools.md`.
- Precedence, restated in `using-superpowers`: user instructions (`CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`, direct requests) > skills > default behaviour.

### Portability gotchas (Appendix B, quoted)

- **"Opt-in isn't a port."** Any per-session action by the user fails the acceptance test.
- **"Wrong JSON field → silent failure or double injection."** *"Claude Code reads two fields without
  dedup."*
- **`@`-include is not guaranteed to expand.** A Gemini-derived harness may emit a file-read tool call
  instead of inlining. Use a **unique-marker test**: inject a nonsense token, start a fresh session,
  confirm the token reached the model without a tool call.
- **"A fork does not inherit its parent's behavior."** Verify with a marker; don't assume the parent's
  recipe transfers.
- **"Hunting for a skill-registration API that doesn't exist."** With no native skill tool, the
  sanctioned fallback is to have the model `read` the relevant `SKILL.md`.

### Distribution

`superpowers-marketplace` ([repo](https://github.com/obra/superpowers-marketplace)) is a two-file
repo: a README and `.claude-plugin/marketplace.json`. Register with `/plugin marketplace add
obra/superpowers-marketplace`, install with `/plugin install superpowers@superpowers-marketplace`; the
core entry is `{"name": "superpowers", "source": {"source": "url", "url":
"https://github.com/obra/superpowers.git"}, "strict": true}`. The plugin's own
`.claude-plugin/marketplace.json` (`superpowers-dev`) and `.agents/plugins/marketplace.json` describe
the same plugin for two ecosystems. For the eval loop the docs point at
`skill-creator@claude-plugins-official`: per-case subagents, `evals/evals.json` inside the skill
directory, plus `grading.json`, `benchmark.json`, and blind A/B between two skill versions.

## Sources

**Superpowers** (v6.3.0, `main` @ `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`) — repo/README
https://github.com/obra/superpowers · https://github.com/obra/superpowers/blob/main/README.md · tree
https://api.github.com/repos/obra/superpowers/git/trees/main?recursive=1 · snapshot read for all
quotes https://codeload.github.com/obra/superpowers/tar.gz/refs/heads/main · writing-skills (SKILL.md,
anthropic-best-practices.md) https://github.com/obra/superpowers/tree/main/skills/writing-skills ·
using-superpowers (SKILL.md, `references/codex-tools.md`, `references/gemini-tools.md`)
https://github.com/obra/superpowers/tree/main/skills/using-superpowers · subagent-driven-development
(SKILL.md, implementer-prompt.md, task-reviewer-prompt.md, scripts/task-brief, scripts/sdd-workspace,
scripts/review-package) https://github.com/obra/superpowers/tree/main/skills/subagent-driven-development
· brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging,
verification-before-completion, dispatching-parallel-agents
https://github.com/obra/superpowers/tree/main/skills · hooks
https://github.com/obra/superpowers/tree/main/hooks · manifests
https://github.com/obra/superpowers/tree/main/.claude-plugin (also `.codex-plugin/`,
`.cursor-plugin/`, `.devin-plugin/`, `.agents/plugins/marketplace.json`) · porting guide + CLAUDE.md
https://github.com/obra/superpowers/blob/main/docs/porting-to-a-new-harness.md · marketplace
https://github.com/obra/superpowers-marketplace

**Anthropic / Agent Skills** — Claude Code skills https://code.claude.com/docs/en/skills ·
specification https://agentskills.io/specification · best practices
https://agentskills.io/skill-creation/best-practices · engineering blog
https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills · format
spec https://github.com/anthropics/skills/blob/main/agent_skills_spec.md · `skill-creator` plugin
https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator
