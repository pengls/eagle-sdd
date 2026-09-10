# Xiaomi MiMo Code — "Compose" mode

Implementation principles of MiMo Code's `compose` mode (小米 MiMo Code 编程工具), covering both shipped
implementations: the **legacy Compose agent** and the newer **`compose-next`** skill.

Sources are primary: the official docs site, the MIT-licensed repo `XiaomiMiMo/MiMo-Code`, and upstream
`obra/superpowers`, which Compose was ported from. Every claim cites its URL. Things the sources do not establish
are marked **not documented**; my deductions are `[inference]`.

## Summary

- MiMo Code has **three built-in primary agents** — `build`, `plan`, `compose` — plus subagents `general` /
  `explore` and hidden system agents (Compaction, Title, Summary).
- **Compose is not a different model or a bigger prompt — it is a skill-orchestration agent.** Focused skills are
  embedded in the binary, extracted on first use, and the agent loads the right one per workflow step.
- **Two implementations coexist, and the docs site only describes the older one:** (1) **Legacy Compose** — the
  `compose` primary agent (Tab), orchestrating **14 bundled `compose:*` skills**; (2) **Compose Next** — one
  self-contained builtin skill, `compose-next`, run from the **build** agent via `/compose-next`, now the
  recommended path for frontier models.
- The docs page is **stale**: it lists 13 skills including a `compose:new-skill` that does not exist, while
  omitting `compose:ask` and `compose:report`, both load-bearing in the real workflow.
- Compose is a **port of `obra/superpowers`** — a harness-agnostic skills framework — so most mechanics are
  prompt-only conventions, not MiMo-specific tooling. MiMo Code itself is **a fork of OpenCode**.

## Modes overview

| Agent | Kind | Role (verbatim, [zh/modes](https://mimo.xiaomi.com/zh/mimocode/modes)) |
|---|---|---|
| `build` | primary | "default primary agent with full tool access for general development work" |
| `plan` | primary | "restricted primary agent for read-only analysis and planning" |
| `compose` | primary | "primary agent that orchestrates work through built-in skills" |
| `general` | subagent | general-purpose, full tool access except `todo` |
| `explore` | subagent | "a fast read-only agent for exploring the codebase" |

Hidden primary agents `Compaction` / `Title` / `Summary` "run automatically and cannot be selected in the UI"
([zh/agents](https://mimo.xiaomi.com/zh/mimocode/agents)).

**How Compose differs.** Verbatim ([zh/modes](https://mimo.xiaomi.com/zh/mimocode/modes)):

> 它不取代 `build`；而是通过添加一个工作流感知模式来与之互补 —— 在该模式下，模型被鼓励以命名、可复用的技能而非
> 临时步骤来思考问题。
>
> "It does not replace `build`; it complements it by adding a workflow-aware mode — one in which the model is
> encouraged to think in terms of named, reusable skills rather than ad-hoc procedures."

The same page states Compose "不依赖单一的庞大提示词" ("does not rely on a single monolithic prompt") but instead
"查阅一个包含 13 个聚焦技能的库 …… 并为工作流的每一步选择合适的技能" ("consults a library of 13 focused skills… and
selects the right skill for each step"). `plan` differs by **tool permission**, not prompt: `write`, `edit`,
`patch`, `bash` disabled — one carve-out: "`edit` - 无法修改现有文件，但位于 `.mimocode/plans/*.md` 的文件除外，用于
详细说明计划本身" ("cannot modify existing files, **except for files at `.mimocode/plans/*.md`**, to detail the
plan itself").

**Activation and mode lock.** Press **Tab** (or the configured `switch_agent` keybind), or use `@compose`; "No
additional configuration is required." The sticky lock is absent from the docs site but stated in the README:

> After the first message the mode locks: Build and Plan can still switch between each other, but Compose is
> isolated once entered — keeping the skill/tool set fixed from session start significantly improves tool-call
> reliability. — [README](https://github.com/XiaomiMiMo/MiMo-Code)

Per [sticky-agent-mode.md](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/docs/compose/reports/sticky-agent-mode.md):
`FREE_SWITCH_GROUP = ["build", "plan"]`; the lock is **derived** from session content
(`sessionHasMessages = !!lastUserMessage()`) rather than a managed boolean; user actions go through a guarded
`userSwitch()`, system paths (session restore, plan tools, CLI) through unguarded `set()`. Rationale: *"a boolean
`lock()` breaks on `/new` and `/session` transitions."*

**Legacy vs Next.** The [README](https://github.com/XiaomiMiMo/MiMo-Code) recommends "the **`/compose-next`** skill
on the **build** agent: a single self-contained contract covering grill → workspace → spec → implement → verify →
review → finalize → finish, with feature documents at `docs/compose/spec/<feature>.md` under the workspace root…
designed for frontier models", versus legacy "the dedicated **compose agent** (switch with `Tab`), which
orchestrates fourteen built-in skills… a step-by-step curriculum that remains useful for weaker models." Per
[compose-next.md](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/docs/compose/spec/compose-next.md) §S1,
legacy "bundles three concerns into one agent mode: permission policy…, workflow curriculum…, and UI state
(Tab-cycle entry, status bar, dialog filtering)"; frontier models "internalize most of it and benefit more from one
compact executable contract." The paths are fenced at prompt level: "do not load or recommend the `compose-next`
skill from legacy Compose… If a user explicitly asks for Compose Next, direct them to switch to Build."

## Compose workflow phases

### Path 1 — legacy curriculum (compose agent)

Phases declared by the deterministic `compose` workflow
([compose.js](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/workflow/builtin/compose.js)),
details verbatim: **Brainstorm** ("Context recon (never-ask): conventions, recent changes, relevant files") →
**Design** ("Apply compose:plan, compose:debug, or compose:feedback; emit task list with deps") → **Implement**
("Topo-sorted batches; independent tasks parallelize in per-task worktrees, then integrate") → **Verify** ("Run
project verify commands; structured pass/fail") → **Review** ("compose:review for critical/important/minor
issues") → **Report** ("compose:report per-iteration + final consolidated report") → **Merge** ("compose:merge to
commit (and optionally push/PR)").

Interactive skill chain, with gates:

1. **`compose:brainstorm`** — explore context → clarify one question at a time → propose 2–3 approaches → present
   the design **in sections**, approving each → optionally write spec → self-review → **user review gate** → hand
   off. "**The terminal state is invoking compose:plan.**"
2. **`compose:worktree`** — detect existing isolation → native worktree tool first, git fallback → install deps →
   **verify a clean test baseline** (failures need user permission to proceed).
3. **`compose:plan`** — bite-sized zero-context plan → self-review (spec coverage / placeholder scan / type
   consistency) → **execution-style gate** (subagent vs inline).
4. **`compose:subagent`** or **`compose:execute`** — per-task execution with review; `execute` is batched with
   checkpoints, `subagent` dispatches a fresh subagent per task.
5. **`compose:tdd`** → **`compose:verify`** (evidence-before-claims gate) → **`compose:review`** (reviewer
   subagent given SHAs, never session history) → **`compose:report`** (consolidate spec history into one
   final-state report, then **invokes `compose:merge`**) → **`compose:merge`** (verify tests → detect
   environment → present exactly 4 options: merge / PR / keep / discard).

Cross-cutting: **`compose:ask`** (single source of truth for decisions), plus `compose:debug`,
`compose:parallel`, `compose:feedback`.

### Path 2 — Compose Next (`/compose-next`, build agent)

Verbatim from
[compose-next/SKILL.md](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/skill/builtin/.bundle/compose-next/SKILL.md):

**Step 0 — Orient.** "Inspect the repository, its instructions (`AGENTS.md`, `README`, existing spec files), and
recent changes before asking anything. Do not ask the user for facts the environment already answers." Three
shapes: fully constrained mechanical change → skip Grill and Spec, go Workspace then Implement; requirements
ambiguous → Grill first; requirements clear but deserving a durable document → Workspace then Spec. Hard
invariant: "**Every path passes through Workspace before Spec or Implement; no branch skips it.**"

**Grill / Workspace / Spec.** "Resolve one decision axis at a time. A single decision may bundle multiple
dependent fields in one structured question; unrelated decisions require separate turns." Use the `question` tool
for every decision; "List the recommendation first and mark its label `(Recommended)`." Then: "Never begin
implementation on `main` or `master` without explicit user consent" — default is a linked worktree at
`.worktrees/<slug>` guarded by `git check-ignore`, and it refuses to nest ("Compare `git rev-parse --git-dir` with
`git rev-parse --git-common-dir`. If they differ, use the current linked worktree; do not nest another"). Then:
"Maintain one document per feature at `docs/compose/spec/<feature-name>.md` from the workspace root. Do not add a
date to the filename… Edit an existing document in place; never create a separate plan or report."

**Implement.** "set its `status: in-progress` on the first implementation commit. Execute tasks in dependency
order. Track multi-step work with the `task` tool." Test-first is conditioned, not absolute: "write a failing
test… Skip test-first for generated code, configuration-only changes, throwaway prototypes, or explicit user
direction." "After two failed fixes, stop patching and re-derive the cause." "Continue through tasks without
routine approval pauses. Stop only for an unresolved product decision, a blocker that cannot be worked around, a
destructive action requiring consent, or completion."

**Verify / Review.** "Before any completion claim, run the repository's relevant tests, typecheck, build, or
reproduction from the correct directory and read the output. Record each command and result. Mark known baseline
failures as `PRE-EXISTING`." "**Verification and review are strictly sequential.**" Then "dispatch one fresh
subagent to review the complete change," requiring three separate conclusions: **spec compliance** ("every
acceptance criterion is met and points to evidence in the diff or reviewer-observed command output"),
**correctness** (logic, boundaries, error handling, regressions, tests, "including issues outside the written
spec"), and **codebase consistency** (naming, structure, local conventions). Plus a **non-convergence stop gate**:
"If the fix-and-re-review loop stops converging — repeated findings on the same area, or fixes that introduce new
criticals — stop looping and report the impasse with the remaining findings instead of forcing a pass." And a model
floor: "Use a reviewer model at least as capable as the strongest implementer it reviews."

**Finalize.** Set `status: delivered`, record `commits: <base-sha>..<head-sha>`, check off tasks, replace `Report`
with What was built / Verification / Journey log. It pre-empts a literal re-reader: "This documentation-only commit
sits outside the recorded reviewed range by construction; it does not restart verification or review."

**Finish.** "Do not auto-finish." Report branch/base/head/workspace/doc path and suggest a closing action.

### Human approval gates

| Gate | Mechanism | Source |
|---|---|---|
| Design section approval (legacy) | `compose:ask`, header `Design Review`, `Looks good` / `Needs changes` | brainstorm |
| Spec file review (legacy) | `compose:ask`, header `Spec Review`, `Approved` / `Changes needed` | brainstorm |
| Worktree consent; failing baseline | `compose:ask`, header `Worktree` (4 options incl. "Always/Never"); then `Proceed anyway (Recommended)` / `Investigate first` | worktree |
| Execution style | `compose:ask`, header `Execution`, 4 options incl. "always / this time" | plan |
| Spec approval (Next) | `question` tool, before implementation | compose-next |
| Destructive discard | `compose:ask`, header `Confirm Discard`; **never auto-approved** | merge, ask |
| Finish action (Next) | `question` tool: merge / PR / push only / keep branch | compose-next |

The load-bearing rule: a gate **must** be a tool call, never prose (see below).

## Artifact/file model

All artifacts are **plain Markdown with YAML frontmatter**, committed to the repo — no database artifact, no
MiMo-proprietary format.

```
docs/compose/            # DEFAULT_DOCS_DIR, overridable via compose.docs
  specs/                 # design docs:  YYYY-MM-DD-<topic>-design.md   (legacy brainstorm)
  plans/                 # plans:        YYYY-MM-DD-<feature-name>.md   (legacy plan)
  reports/               # reports:      <feature-name>.md              (legacy report)
  spec/                  # feature docs: <feature-name>.md              (compose-next)
```

From [compose.ts](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/config/compose.ts):
`DEFAULT_DOCS_DIR = "docs/compose"`; `compose.docs` overrides it; `compose.docs_absolute: true` anchors a relative
value to the active worktree root. The value is injected as
`<compose_docs_dir>{{compose_docs_dir}}</compose_docs_dir>`, and skills "reference this block to determine where to
save specs, plans, and reports." The repo dogfoods these paths. **Compose Next hardcodes the path**, because "that
block only exists for the Compose agent and `compose.js`, neither of which is in the `/compose-next` path."

Naming is mechanistically meaningful: **specs are accumulative** (a new dated file per iteration), **plans are
dated**, and **reports are overwritten in place, never dated** — "the report is overwritten in place when the
feature evolves. Git history tracks revisions" ([report](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/skill/compose/.bundle/report/SKILL.md)).
**Compose Next unifies and drops the date**: one document per feature carrying design + tasks + delivery evidence,
because it will "never create a separate plan or report."

### Compose Next feature document (exact template)

```markdown
---
feature: <feature-name>
status: designed | in-progress | delivered
updated: YYYY-MM-DD
branch: <branch-name>
commits: <base-sha>..<head-sha> # filled at delivery
---

# <Feature Name>

## Report

## [S1] Problem
Describe the user-visible problem.

## [S2] Design
Record the chosen behavior and the contracts needed to implement it.

## [S3] Out of Scope
State explicit boundaries.

## Tasks
- [ ] T1: <work item> — acceptance: <observable result> (covers: S2)
- [ ] T2: <work item> — acceptance: <observable result> (covers: S2; depends: T1)
```

Rules: "Leave `Report` empty and set `status: designed`"; "Keep `[Sn]` anchors stable when headings change;
**never renumber existing anchors**"; "**Every design requirement must be covered by at least one task; every
reference must resolve**"; "`depends:` only for real prerequisites; dependencies must be acyclic"; remove `TBD`
placeholders.

**Legacy equivalents.** `compose:plan` writes a dated plan with per-task `**Covers:**`, `**Files:**`
(Create/Modify/Test with exact paths and line ranges) and `**Interfaces:**` (Consumes / Produces with exact
signatures), then five checkbox steps: write the failing test → run and see it fail → minimal implementation → run
and see it pass → commit; "Each step is one action (2-5 minutes)." The `Interfaces: Produces` block *is* the
subagent context channel: "An implementer sees only its own task; this block is how it learns the names and types
neighboring tasks use." `compose:report` injects an idempotent `> [!NOTE]` admonition (GitHub syntax) into every
referenced spec/plan pointing at the final report, since consolidation must be non-destructive; frontmatter carries
back-links (`specs: [...]`, `plans: [...]`, `branch`, `commits`) — "**Machine-readable** … **Bidirectional** —
Report links to specs/plans, they link back."

**Other on-disk state.** Worktrees default to `.worktrees/<slug>`; project-local dirs **must** be git-ignored
first. Framework-level memory (not compose-specific) per the [README](https://github.com/XiaomiMiMo/MiMo-Code):
`MEMORY.md`, `checkpoint.md` ("maintained automatically by the checkpoint-writer subagent"), `notes.md`,
`tasks/<id>/progress.md`, plus a tree-shaped task system `T1, T1.1, T1.2, …`; sessions are a SQLite database under
`$MIMOCODE_HOME/data/` ([zh/sessions](https://mimo.xiaomi.com/zh/mimocode/sessions)).

## Prompt & state mechanics

**The legacy Compose system prompt.** `packages/opencode/src/session/prompt/compose.txt` (133 lines) opens: "You
are the MiMoCode Compose Agent — an orchestrator that coordinates specialized skills into coherent workflows.
Where Build executes directly and Plan reasons read-only, you bring structure: every task gets the right skill
applied at the right time." Its enforcement block is the core anti-rationalization mechanism — it denies the model
the information needed to pre-judge relevance:

> When a skill matches your task, you MUST load it before acting… **NEVER decide to skip a skill based on its
> description alone. The skip conditions are INSIDE the skill content.** You must invoke, read the loaded content,
> then determine which sections apply.

Reinforced by a Red Flags table of excuse → check ("The skill is overkill" → "Invoke it — skip conditions are
inside, not in the description"). Instruction priority ranks the user above skills: (1) user's explicit instructions
/ CLAUDE.md, (2) Compose skills, (3) default system prompt. Completion is a tri-conjunct — code changes made,
verification RUN with confirmed passing output, changes minimal — plus: "DO NOT claim completion without a
preceding verification tool call. 'Should be fixed' without evidence is NOT completion."

**Skill bundles ship in the binary, extracted to disk.** Docs: "技能包在首次使用时会被解压到
`{data}/compose/{version}/`" ("the skill bundle is extracted to `{data}/compose/{version}/` on first use").
[extract.ts](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/skill/compose/extract.ts)
shows the mechanism: skills are embedded via a **Bun macro** (`bundle.macro.ts`, `loadComposeBundle()`), extracted
to `<data>/compose/<version>/skills/<skillName>/<relPath>`, with a `.extracted` marker holding the version that
short-circuits re-extraction; extraction is skipped in dev (`InstallationLocal`).

**Skill discovery, permissions, visibility.** Skills are discovered from `.mimocode/skills/**/SKILL.md` (and
`skill/**`), `~/.config/mimocode/skills/**`, plus compat dirs `.claude`, `.agents`, `.codex`, `.opencode`.
`SKILL.md` is found recursively and the **name comes from frontmatter, not the folder**; only `name`,
`description` and `hidden` are read ("其他任何 frontmatter 字段都会被忽略" — "any other frontmatter fields are
ignored"). Skills surface as an `<available_skills>` XML list in the `skill` tool description and load via
`skill({ name: "…" })` ([zh/skills](https://mimo.xiaomi.com/zh/mimocode/skills)). Compose skills are hidden from
default agents by **permission rules**, not the `hidden` flag: "`defaults` includes
`skill: { "*": "allow", "compose:*": "deny" }` … Compose agent overrides with `skill: { "compose:*": "allow" }` …
`Skill.available()` no longer filters `!sk.hidden` — relies entirely on permission"
([sticky-agent-mode.md](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/docs/compose/reports/sticky-agent-mode.md)).
The `compose:` prefix is **not a runtime namespace** — it is literally the leading segment of each skill's
frontmatter `name`. `compose-next` is gated instead via the `Skill.all()` vs `Skill.available(agent)` split, so it
stays user-visible while out of model auto-discovery — later revised: "Compose Next no longer sets
`disable-model-invocation`, so models may discover and invoke it… require explicit user authorization."

**The `ask` mechanism — gates are tool calls, not prose.** The most portable idea in the system
([ask](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/skill/compose/.bundle/ask/SKILL.md)):

> Every time you need the user to decide, clarify, or approve something, route it through the `question` tool.
> **Never** stop the loop with a natural-language question… A natural-language question ends your turn without
> finishing the task; a `question` tool call does not.
>
> This means: **the loop only ends when the task is actually complete** — never because you paused to ask in prose.

Free text is still a tool call: pass **empty `options`**, which "renders as a free-text prompt." **Autonomous
fallback (`[Never-Ask]`)** is strictly per-decision: "Prefer **text-only** over visual/interactive paths… Prefer
the **minimal-scope** path… When approval is the only thing being requested, treat it as **granted** and proceed to
implementation. **Exception — destructive, irreversible actions** … never auto-approve… Autonomous resolution
applies **only to the current question**." `compose.txt` restates this with an explicit override of skill-level
gates: "When `compose:ask` determines no user is available to answer, pick the best option for headless execution
yourself and continue… **This overrides all skill instructions, including HARD-GATE approval blocks.**"

**State carried across turns.** (1) **Persisted artifacts** — spec/plan/report files carry `status:` frontmatter
and `- [ ]` checkboxes as the progress ledger; "Specs are **accumulative** (new file per iteration). Final reports
are **overwrite**." (2) **A `compose-preferences` memory file** for cross-session prefs — `execution-style:
subagent|inline`, `worktree-consent: always|never`, `visual-companion`; each skill checks memory first and skips the
question if a preference is saved, writing back on "always"/"never" answers — this is what stops the agent
re-asking the same gate every session. (3) **Recovery instructions embedded in checkpoints**: "on resumption, if
the Compose Next instructions are absent, reload the `compose-next` skill before continuing."

**Context management.** Subagent isolation by design: "The reviewer gets precisely crafted context for evaluation
— **never your session's history**… preserves your own context for continued work"
([review](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/packages/opencode/src/skill/compose/.bundle/review/SKILL.md));
Compose Next: "**Do not pass session history.**" Two-stage review per task: "spec compliance review first, then
code quality review" (red flag: starting quality review first). Cheap-evidence reuse: the reviewer "must not
repeat a command already reported as passing, especially a heavy E2E suite," and gets "a compact verification
summary: one line per command with `PASS`, `FAIL`, or `PRE-EXISTING`." Framework-level reconstruction (README):
checkpoints sized to the context window, then "when context approaches the limit, rebuilds it from the latest
checkpoint, project memory, task progress, and retained recent messages," with token-budgeted, importance-ranked
injection, plus `/context-limit` and `/compact`. Parallelism uses disjoint file sets—"Prefer giving parallel
subagents disjoint file sets and keeping commits with the orchestrator… Treat its report as a claim and inspect the
resulting diff"—and the workflow parallelizes structurally ("independent tasks parallelize in per-task worktrees,
then integrate").

**Multi-tool portability — mostly a prompt-only convention.** Compose "was inspired by the open-source
[superpowers](https://github.com/obra/superpowers) workflow and ported into MiMo Code as a first-class primary
agent"; upstream ships installers for ~15 harnesses (Claude Code, Codex, Cursor, Gemini CLI, Copilot CLI, Kimi
Code, OpenCode, Pi, Hermes, Devin, Droid, Antigravity, Grok) plus `docs/porting-to-a-new-harness.md`. The prompt
abstracts over tool surfaces: "If `skill` is a top-level tool, call it directly. In GPT/Codex mode, call `exec`
with `const result = await tools.skill({ name: "<skill-name>" }); return result.output`. Never call a tool that is
absent from the current surface." Worktrees prefer native tools over git — "Using `git worktree add` when you have
a native tool creates phantom state your harness can't see or manage" — with provenance-gated cleanup.
**MiMo-specific:** the `question` tool / `[Never-Ask]` protocol; the `compose:` prefix and its filtering sites;
`[compose_docs_dir]` and `compose.docs`; Bun-macro bundling; the memory files and checkpoint-writer subagent; the
`task`, `actor` and `exec` tools. The **workflow content** — phases, artifact formats, gates, review structure —
is portable as-is.

## Notable design ideas worth stealing

1. **"The skip conditions are INSIDE the skill content."** Denies the model the information needed to rationalize
   skipping, forcing load-then-decide. Pair with a Red Flags table of excuse → check.
2. **Gates as tool calls, never prose.** Asking doesn't end the turn, so the loop terminates only on real
   completion, and every gate becomes a structured record. Free text is `options: []`.
3. **Per-decision autonomous fallback with a destructive-action exception.** `[Never-Ask]` is scoped to the current
   decision only — never generalized into a permanent mode — and destructive actions never auto-approve. One
   skill, runnable both interactively and headless.
4. **A shared decision skill instead of repeated fallback text:** "Other compose skills reference it at their
   decision points instead of repeating fallback text, so the rules stay consistent and the prompts stay small."
5. **Stable spec anchors (`[S1]`, `[S2]`) plus a `covers:` / `depends:` task graph.** Turns prose into a traceable
   graph: every requirement covered by ≥1 task, every reference resolvable, dependencies acyclic, giving
   implementers and reviewers a join key. "Never renumber existing anchors" is load-bearing — renumbering silently
   breaks every downstream reference.
6. **Evidence-gated completion.** A five-step gate (IDENTIFY → RUN → READ → VERIFY → CLAIM) whose "not sufficient"
   column names *prior runs*, *agent success reports* and *linter-passes-so-build-passes* as non-evidence, plus
   "Violating the letter of this rule is violating the spirit of this rule."
7. **One feature document carrying design + tasks + delivery report**, inverting the accumulative-spec pattern.
   "Never create a separate plan or report" kills document drift by construction; `Report` is reserved-empty at
   design time and filled at delivery.
8. **Reviewer isolation, capability floor, evidence reuse.** Diff coordinates plus a one-line-per-command summary,
   "Do not provide an implementer-authored narrative," a reviewer model "at least as capable as the strongest
   implementer," and no unjustified re-runs of heavy passing commands.
9. **A judgment-based non-convergence stop gate** instead of a hardcoded max round count, naming observable
   impasse signals; the journey log records that "a hardcoded round count was rejected in favor of
   judgment-based non-convergence signals."
10. **Derive state, don't manage it; state the surprising invariant.** Mode locking from `!!lastUserMessage()`
    and worktree detection from `GIT_DIR != GIT_COMMON` handle `/new`, `/session` and submit transitions for free
    where a managed boolean breaks. Workspace ownership is an invariant ("Every path passes through Workspace
    before Spec or Implement"), the finalize commit's position outside the reviewed SHA range is stated explicitly
    so a literal reader doesn't loop, and deprecation copy went into the agent *description* only — "any byte
    change to a model-facing system prompt invalidates prefix cache for every existing Compose session."

## Open questions / not documented

- **The docs site never documents Compose Next.** [zh/mimocode/modes](https://mimo.xiaomi.com/zh/mimocode/modes)
  describes only the legacy Compose agent; the `/compose-next` path, the `docs/compose/spec/<feature>.md` artifact
  and the frontier-model recommendation exist **only in the README and source**.
- **Skill count mismatch.** The docs list 13 skills including `new-skill`; the shipped bundle has **14
  directories** — `ask`, `brainstorm`, `debug`, `execute`, `feedback`, `merge`, `parallel`, `plan`, `report`,
  `review`, `subagent`, `tdd`, `verify`, `worktree`. So `new-skill` **does not exist**, while `ask` and `report` —
  both load-bearing — are **undocumented**. The README's "fourteen" agrees with the source, not the docs page.
- **Other pages are stale about modes too.** [zh/agents](https://mimo.xiaomi.com/zh/mimocode/agents) states "MiMo
  Code 内置了两个主代理：**Build** 和 **Plan**" and
  [zh/interaction](https://mimo.xiaomi.com/zh/mimocode/interaction) likewise lists only Build and Plan — both omit
  `compose`.
- **Not documented:** the phase sequence, artifact formats and approval gates at docs level (source only); whether
  `/compose-next` works in `plan` or `compose` (the spec says its consumer is "any primary agent (in practice,
  Build)", and legacy Compose is forbidden from loading it); the `question` tool's schema/semantics (skills show
  call shapes, `[Never-Ask]` is behavioural, but there is no docs page for `question`, `actor`, `task` or `exec`);
  the `compose-preferences` memory file's location, format and eviction; how the `compose` workflow chains
  structured output between phases; and any published eval comparing compose vs build outcomes (there are tests
  and an upstream `superpowers-evals` harness, but no results).

`[inference]` **Fork lineage.** The skill/permission/agent architecture (agent frontmatter,
`mode: primary|subagent`, `tools` map, `permission.skill` globs, `.opencode` compat) is inherited from OpenCode
rather than invented for Compose. Evidence: the README's "Relationship to OpenCode" section ("built as a fork of
OpenCode… adds persistent memory, intelligent context management, subagent orchestration, goal-driven autonomous
loops, compose workflows"), source paths under `packages/opencode/`, and `.opencode` compat dirs. That the schema
is *unchanged* from OpenCode is inference, not stated.

`[inference]` **Provenance of the 14 skills.** They look like **near-verbatim superpowers ports**, mapping 1:1
(brainstorming→brainstorm, writing-plans→plan, executing-plans→execute, subagent-driven-development→subagent,
test-driven-development→tdd, systematic-debugging→debug, verification-before-completion→verify,
requesting-code-review→review, receiving-code-review→feedback, using-git-worktrees→worktree,
finishing-a-development-branch→merge, dispatching-parallel-agents→parallel). The bundle ships
`LICENSE-superpowers` and `LICENSE-karpathy`, and `brainstorm` references an upstream `visual-companion.md`.
Content is adapted — the legacy skills reference `compose:ask` and `compose-preferences`, both MiMo additions
(upstream has no `ask` skill) — and `compose:new-skill` looks like a rename of superpowers' `writing-skills`,
though no such file exists in the bundle, so the capability appears dropped or relocated.

`[inference]` `compose:ask`'s prohibition on prose questions is what makes the legacy curriculum resumable across
many turns without the user re-anchoring the agent; with checkpoints, that is how a multi-hour run survives
compaction.

## Sources

All Compose paths below resolve under `https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/<path>` or the
`/blob/main/<path>` form on github.com.

- **Docs:** [/zh/mimocode/modes](https://mimo.xiaomi.com/zh/mimocode/modes) · [/mimocode/modes](https://mimo.xiaomi.com/mimocode/modes) (English) — modes, Compose, 13-skill table, `{data}/compose/{version}/`; [/zh/mimocode/skills](https://mimo.xiaomi.com/zh/mimocode/skills) · [/mimocode/skills](https://mimo.xiaomi.com/mimocode/skills) — SKILL.md discovery, frontmatter, `<available_skills>`, permissions; [/zh/mimocode/agents](https://mimo.xiaomi.com/zh/mimocode/agents); [/zh/mimocode/sessions](https://mimo.xiaomi.com/zh/mimocode/sessions); [/zh/mimocode/rules](https://mimo.xiaomi.com/zh/mimocode/rules); [/zh/mimocode/interaction](https://mimo.xiaomi.com/zh/mimocode/interaction); [/zh/mimocode/commands](https://mimo.xiaomi.com/zh/mimocode/commands); [/zh/mimocode/changelog](https://mimo.xiaomi.com/zh/mimocode/changelog)
- **Repository:** [repo root](https://github.com/XiaomiMiMo/MiMo-Code) (README is the richest single source on Compose Next) · [raw README](https://cdn.jsdelivr.net/gh/XiaomiMiMo/MiMo-Code@main/README.md) · [releases](https://github.com/XiaomiMiMo/MiMo-Code/releases) · [file tree API](https://api.github.com/repos/XiaomiMiMo/MiMo-Code/git/trees/main?recursive=1)
- **Compose source:** `packages/opencode/src/session/prompt/compose.txt` (agent prompt, 133 lines) · `packages/opencode/src/config/compose.ts` · `packages/opencode/src/skill/compose/extract.ts` + `bundle.macro.ts` · `packages/opencode/src/skill/builtin/.bundle/compose-next/SKILL.md` (197 lines) · `packages/opencode/src/workflow/builtin/compose.js` · `packages/opencode/src/skill/compose/.bundle/<name>/SKILL.md` for `<name>` ∈ {`ask`, `brainstorm`, `debug`, `execute`, `feedback`, `merge`, `parallel`, `plan`, `report`, `review`, `subagent`, `tdd`, `verify`, `worktree`}
- **Design docs / reports:** `docs/compose/spec/compose-next.md` · `docs/compose/reports/sticky-agent-mode.md` · `docs/compose/spec/skill-invocation-control.md`, `skill-multi-injection.md`, `plan-enter-removal.md`, `plan-no-continue.md` · `docs/compose/specs/2026-07-14-orchestrator-route-first-redesign.md`
- **Upstream:** [obra/superpowers](https://github.com/obra/superpowers) — the framework Compose was ported from · [raw README](https://cdn.jsdelivr.net/gh/obra/superpowers@main/README.md) · [release announcement](https://blog.fsck.com/2025/10/09/superpowers/) (referenced by the README; not fetched)
- **Distribution:** `@mimo-ai/cli` 0.1.14, MIT, publisher `mimo-research <mimo@xiaomi.com>` (via `npm search mimocode`). The similarly named `mimocode` package by `mimodino/eurocybersecurite` is **unrelated** to Xiaomi.
