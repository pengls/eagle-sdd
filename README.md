# eagle-sdd

> Write the design first. Plan it task by task. Implement against the plan. Verify against the design.

A portable, manually-invoked **spec-driven development** skill for Codex, Claude Code,
DeepSeek Harness, and any other agent that can read a file and run a command.

One skill. Two documents per change. No runtime dependency. The rules it states are enforced by
a zero-dependency validator, not by asking the model nicely.

```
docs/eagle-sdd/
├── designs/2026-08-04-store-search-layout-design.md   what was decided, and why
└── plans/2026-08-04-store-search-layout.md            what was done, task by task
```

---

## Contents

- [Why this exists](#why-this-exists)
- [Install](#install)
- [Use](#use)
- [What it produces](#what-it-produces)
- [The seven steps](#the-seven-steps)
- [The validator](#the-validator)
- [Harness support](#harness-support)
- [Repository layout](#repository-layout)
- [Design and provenance](#design-and-provenance)
- [Upgrading from 1.x](#upgrading-from-1x)
- [Development](#development)

---

## Why this exists

Most spec-driven workflows ask you to maintain a canonical spec tree and record each change as a
delta against it. That is the right shape when a system needs one current description. It is the
wrong shape when what you actually want is a **durable record of what was decided on a given day**
— which is what hand-run workflows tend to produce, and what the reference implementations studied
for this skill emit.

So this skill writes one dated pair per change and never merges anything:

- **The design document is frozen.** Nothing rewrites it. A change of mind is a new dated pair,
  so the record is append-only and you can always see what was believed at the time.
- **The plan document is executable by someone who was not there.** Each task carries the exact
  code, the exact command that proves it landed, and its own commit. That is usually a fresh
  agent with no memory of the conversation.
- **Verification is evidence-gated.** "The tests pass" only proves the tests agree with the code.
  This asks *is this the thing we agreed to build*, against the design document, and requires
  evidence produced in this session. Prior runs and subagent success reports do not count.
- **Manual invocation only.** It is a deliberate, expensive workflow. No agent can decide on its
  own that your request needs it.

## Install

No clone required.

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.sh | sh
```

```powershell
# Windows
irm https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.ps1 | iex
```

It writes to `~/.agents/skills/` — read by Codex, Copilot CLI, Gemini CLI, and DeepSeek Harness —
and to `~/.claude/skills/` for Claude Code. The downloaded skill is kept once at
`~/.eagle-sdd/skill` and each root links to it, so updating is one command and nothing is
duplicated. On Windows the links are directory junctions, which need neither administrator rights
nor Developer Mode.

### Update, check, remove

```sh
sh install.sh              # or the curl one-liner again — this is how you update
sh install.sh --check      # report whether an update is available; exits 2 when behind
sh install.sh --uninstall  # remove every link and the download
```

Re-running is safe: work that is already current is left untouched. `--uninstall` sweeps every
documented root, including ones an earlier install wrote at a different scope, so it cannot leave
a dangling link.

### Options

| Flag | Environment variable | Default |
|---|---|---|
| `--ref <git-ref>` | `EAGLE_SDD_REF` | `main` — a branch, tag, or commit |
| `--scope <s>` | `EAGLE_SDD_SCOPE` | `user` remotely; `both` from a checkout |
| `--harness <list>` | `EAGLE_SDD_HARNESS` | `agents,claude` |
| `--install-root <dir>` | `EAGLE_SDD_HOME` | `~/.eagle-sdd` |
| `--copy` | | link, not copy |
| `--local <path>` | | link a checkout instead of downloading |

`--harness` accepts any of `agents`, `claude`, `dsh`, `copilot`, `gemini`.

Since a piped PowerShell script cannot take arguments, use this form to pass any:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.ps1))) -Scope both -Ref v1.0.0
```

### Native plugin installs

| Harness | Install |
|---|---|
| Claude Code | `/plugin marketplace add pengls/eagle-sdd` then `/plugin install eagle-sdd` |
| Codex | the repo declares `skills/` in `.codex-plugin/plugin.json` |

### Working on the skill itself

Clone and run the installer from inside the repo. It detects the checkout and links the roots to
your working tree, so edits take effect immediately:

```sh
git clone https://github.com/pengls/eagle-sdd && cd eagle-sdd
sh install.sh --scope both     # or: powershell -File install.ps1 -Scope both
```

## Use

Invoke it by name. It will not trigger on its own.

```
/eagle-sdd                    Claude Code, DeepSeek Harness
"spec this before coding"     any harness, said explicitly
```

Then follow the gates. The full walkthrough is in [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## What it produces

```
docs/eagle-sdd/
├── designs/<YYYY-MM-DD>-<slug>-design.md   # the design, frozen at its date
└── plans/<YYYY-MM-DD>-<slug>.md            # its implementation plan
```

Two documents, and both are written by hand — the agent drafts, you approve. There is no index,
no configuration file, and nothing that accumulates.

| Document | Holds |
|---|---|
| `designs/<date>-<slug>-design.md` | Requirement summary, confirmed decisions **and the options they beat**, current state and problem, detailed design, out of scope, how to verify |
| `plans/<date>-<slug>.md` | `Goal` / `Architecture` / `Tech Stack` / `Spec`, a file-structure table, then `Task N` blocks — each with checkbox steps, a `Run:`/`Expected:` verification, and a commit |

The two are paired on the shared `<date>-<slug>`, not on a link inside the documents. The
`**Spec:**` line is expected and a broken one always fails, but a missing one is only a warning —
most real plans omit it, and a format that refuses to recognise a correct pair over a convenience
line is a format that gets worked around.

### A task

```markdown
### Task 1: Add the search bar layout CSS

**Files:**
- Modify: `src/.../store.ftl`（the `<style>` block）

- [ ] **Step 1: Append the CSS**

- [ ] **Step 2: Verify**

Run: `rg -n "search-actions" src/.../store.ftl`
Expected: at least four matching lines, no error

- [ ] **Step 3: Commit**

```bash
git add src/.../store.ftl
git commit -m "style: store search bar layout"
```
```

A task whose completion nobody can observe is a heading, not a task.

## The seven steps

| Step | Produces | Done when |
|---|---|---|
| 1. Orient | the change's identity | You know what existing documents cover, and the change is named `<date>-<slug>` |
| 2. Grill | rulings | Every decision is answered or recorded with its cost if wrong |
| 3. Design document | `designs/<date>-<slug>-design.md` | **User approves the decisions** |
| 4. Plan document | `plans/<date>-<slug>.md` | **User sees the task list**; validator clean |
| 5. Implement | code | Every box ticked after reading its verification output |
| 6. Verify | report | Every part of the design maps to evidence run and read this session |
| 7. Close | — | Validator clean, pair complete, result reported |

Before starting, the workflow routes itself. A rename, a typo, a dependency bump, or a bug with
one obvious cause is **declined** — it says so and stops, rather than spending an hour producing
documents for a one-line change.

`SKILL.md` also carries a rationalisation table and a red-flags list, because the interesting
failures here are not "the agent cannot do it" — they are the moments an agent talks itself out of
a gate.

## The validator

```sh
node skills/eagle-sdd/scripts/validate.mjs              # defaults to docs/eagle-sdd
node skills/eagle-sdd/scripts/validate.mjs path/to/tree
```

Zero dependencies, Node 18+. Exits `1` on any error. **12 codes — 8 errors, 4 warnings.**

| Code | Kind | Caught |
|---|---|---|
| `F000` | error | No document tree at that path |
| `F101` | error | A filename that is not `<date>-<slug>[-design].md` |
| `F105` | error | A plan with no `# ` title |
| `F106` | error | A plan with no `**Goal:**` |
| `F108` | error | A `**Spec:**` pointing at a design document that is not there |
| `F109` | error | A plan with no task heading |
| `F110` | error | A task with no `- [ ]` step |
| `F121` | error | A design with no `# ` title |
| `F122` | error | A design with fewer than three sections |
| `F107` | warning | Missing `**Spec:**` |
| `F111` | warning | A task stating no `Expected:` or `Verify:` |
| `F112` | warning | Missing `**Architecture:**` |
| `F130` | warning | A design with no plan of the same slug |

**The validator is optional.** The workflow runs on the checklist alone. It is a real check,
though — the test suite proves every one of the 12 codes actually fires, and that the reference
documents exactly those codes and no others.

**The checks were calibrated against real documents, not the templates.** The first version
required a `**Spec:**` line, a `### Task` heading, and a `Run:`/`Expected:` pair on every task —
and rejected most of eight hand-written plan documents that had verified things differently. The
rules were loosened to match what careful humans actually produce. The principle is recorded next
to the codes: **a check that fails correct work gets disabled, and a disabled check protects
nothing.**

## Harness support

Skills are written to name **actions**, never tools — "ask the user a structured question", not
`AskUserQuestion` — so one body runs everywhere. [`references/harnesses.md`](skills/eagle-sdd/references/harnesses.md)
holds the per-harness translation.

| Harness | Skill roots | Structured question tool |
|---|---|---|
| Claude Code | `.claude/skills/`, `~/.claude/skills/` | `AskUserQuestion` |
| Codex CLI | `.agents/skills/`, `~/.agents/skills/` | none — prose fallback |
| DeepSeek Harness | `.agents/skills/`, `.dsh/skills/`, and their `~` equivalents | `ask_user_question` |
| Copilot CLI | `.agents/skills/`, `~/.copilot/skills/` | — |
| Gemini CLI | `.agents/skills/`, `~/.gemini/skills/` | — |

Manual invocation is enforced three ways, because harnesses read different places:

| Harness | Mechanism |
|---|---|
| Claude Code, DeepSeek Harness | `disable-model-invocation: true` in frontmatter |
| Codex | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` |
| Anything else | the description marks it explicitly-invoked-only |

## Repository layout

```
skills/eagle-sdd/
├── SKILL.md                    the seven steps, the gates, the failure modes
├── references/
│   ├── plan-format.md          the document grammar and all 12 checks
│   ├── verification.md         the evidence gate and the review protocol
│   └── harnesses.md            action → tool mapping per harness
├── assets/templates/           design-doc.md, implementation-plan.md
├── scripts/validate.mjs        zero-dependency structural validator
└── agents/openai.yaml          Codex invocation policy
install.sh / install.ps1        remote installer — download, link, update, uninstall
.claude-plugin/ .codex-plugin/  native plugin manifests
tests/                          33 Node tests
docs/WORKFLOW.md                the flow, written for a human reader
docs/eagle-sdd/                 this project's own documents, written with the skill itself
docs/research/                  primary-source notes behind the design
```

## Design and provenance

The design is not invented from scratch. Three systems were studied from primary sources —
cloned repositories and official documentation, not summaries — and the notes are checked in:

| Note | What it contributed |
|---|---|
| [`docs/research/superpowers.md`](docs/research/superpowers.md) | The document pair itself, skill mechanics, why a `description` must state *when* and never *what*, and the measured finding that prohibitions backfire on output-shaping problems while positive recipes converge. |
| [`docs/research/mimo-compose-mode.md`](docs/research/mimo-compose-mode.md) | Gates as tool calls rather than prose, stable design anchors, the evidence gate, and a single source of truth per change. |
| [`docs/research/openspec.md`](docs/research/openspec.md) | The canonical-and-delta model that this skill shipped and then removed, and the reason: it is the right shape for a system needing one current description, and the wrong shape for an append-only record. |

Two findings worth knowing, because they look like style choices and are not:

- **A `description` that summarises the workflow becomes a shortcut the agent takes.** A measured
  failure: a description saying "code review between tasks" made the agent do *one* review while
  the body specified two. Triggering conditions only.
- **Prohibitions backfire when the problem is the shape of the output.** In head-to-head wording
  tests, the prohibition arm produced *more* of the unwanted content than a no-guidance control.
  This skill uses prohibitions only for discipline failures — the moments an agent knows the rule
  and skips it under pressure — and positive recipes everywhere else.

This repository practices what it ships: its own decisions are recorded in
[`docs/eagle-sdd/`](docs/eagle-sdd/), in the format the skill produces.

## Upgrading from 1.x

Version 2 removes the `spec` document set. If you used it:

1. Delete `docs/eagle-sdd/specs/` and `docs/eagle-sdd/config.yaml`.
2. Anything worth keeping in `docs/eagle-sdd/plans/<change-id>/` should be rewritten as a dated
   pair under `designs/` and `plans/` — or left to git history, which is where the record of a
   deleted format belongs.
3. Re-install: the skill's own files changed, so re-run the installer.

## Development

```sh
node --test                            # 33 cases
node --test tests/validate.test.mjs    # one per validator code
node --test tests/skill.test.mjs       # frontmatter and bundle integrity
npm run validate                       # validate this repo's own documents
```

The skill suite enforces the properties that decide whether the skill loads at all: valid
frontmatter, the portable field budget, the manual-invocation policy, `SKILL.md` under 500 lines,
every referenced file present, that the removed format is genuinely gone, and that the documented
codes and the emitted ones match **in both directions**.

Contributions should keep `node --test` and `npm run validate` green. See [`AGENTS.md`](AGENTS.md)
for the rules that apply to editing the skill itself.

## License

MIT
