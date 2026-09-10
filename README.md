# eagle-sdd

> Write the spec first. Implement against it. Verify against it. Then fold it into the truth.

A portable, manually-invoked **spec-driven development** skill for Codex, Claude Code,
DeepSeek Harness, and any other agent that can read a file and run a command.

One skill directory. No runtime dependency for the workflow. The rules it states are
enforced by a zero-dependency validator, not by asking the model nicely.

```
skills/eagle-sdd/          the skill — drop it in, or link it with scripts/install.*
docs/eagle-sdd/            what it writes in your repo: canonical specs + change plans
```

---

## Contents

- [Why this exists](#why-this-exists)
- [Install](#install)
- [Use](#use)
- [What it produces](#what-it-produces)
- [The workflow](#the-workflow)
- [The validator](#the-validator)
- [Harness support](#harness-support)
- [Repository layout](#repository-layout)
- [Design and provenance](#design-and-provenance)
- [Development](#development)

---

## Why this exists

Most spec-driven workflows treat the spec as an artifact you produce. This one treats it as
a **contract you verify against** — and closes the two holes that make spec-driven
development quietly decay in practice.

### Hole 1 — nothing checks that the spec became work

A proposal names capabilities, the spec defines requirements, the tasks implement them. In
most tools those three documents are related only by prose, so a requirement can silently
never get built. Nothing fails; the change just ships without it.

Here every task carries `Covers:` and `Depends:` tags, **every requirement must be covered by
at least one task**, and the validator fails when one is not.

### Hole 2 — nothing checks that the work became the spec

"We verified it" usually means "the tests pass" — which proves only that the tests agree with
the code. This workflow verifies **requirement by requirement against the spec**, and requires
evidence *produced in this session*. Prior runs and subagent success reports are named
explicitly as things that do not count.

### And the mechanics that keep it usable

- **Deltas, not restatements.** A change stores only `ADDED` / `MODIFIED` / `REMOVED` /
  `RENAMED` requirements. The canonical spec is untouched until archive. A `MODIFIED` block
  that drops a scenario still present in the canonical spec is a hard error, so you cannot
  lose specification by accident. This is what makes brownfield adoption work: you describe
  the diff, not the whole system.
- **Gates are decisions, not prose.** Every unresolved question goes through a structured
  question with real options. A prose question ends the turn and leaves the decision dangling.
- **Manual invocation only.** This is a deliberate, expensive workflow. It is configured so
  no agent can decide on its own that your request needs it.

## Install

```powershell
# Windows
powershell -File scripts/install.ps1                # project + user roots
powershell -File scripts/install.ps1 -Scope user    # user roots only
powershell -File scripts/install.ps1 -Copy          # copy instead of link
```

```sh
# macOS / Linux
sh scripts/install.sh
sh scripts/install.sh user
sh scripts/install.sh user copy
```

Or through npm: `npm run install:windows` / `npm run install:posix`.

Both scripts link the skill — directory junctions on Windows, which need neither administrator
rights nor Developer Mode — so that editing this repository changes the installed skill. If
linking is unavailable they copy, and tell you that copies will not track later edits.
Re-running is safe: an existing correct link is left alone.

## Use

Invoke it by name. It will not trigger on its own.

```
/eagle-sdd            Claude Code, DeepSeek Harness
"spec this before coding"    any harness, said explicitly
```

Then follow the gates. Two of them are the user's to pass:

```
Orient → Grill → Propose ──⟂──> Specify ──⟂──> Design? → Plan → Implement → Verify → Archive
                            approve              approve
```

`Design` is skipped unless the change crosses module boundaries, adds a dependency, alters a
data model, or carries migration or security risk.

## What it produces

```
docs/eagle-sdd/
├── specs/<capability>/spec.md          # canonical truth — only Archive writes here
└── plans/
    ├── <change-id>/                    # one change in flight
    │   ├── proposal.md                 # why + what + which capabilities
    │   ├── design.md                   # only when the change warrants it
    │   ├── tasks.md                    # checkbox tasks with Covers/Depends/Verify
    │   └── specs/<capability>/spec.md  # the deltas this change makes
    └── archive/<change-id>/            # merged changes, kept as the record
```

A requirement is a header plus at least one scenario:

```markdown
### Requirement: Session timeout
Sessions SHALL expire 30 minutes after their last authenticated request.

#### Scenario: Idle session expires
- **WHEN** a session is idle for 30 minutes
- **THEN** the next request is rejected with 401
```

A scenario is a test you have not written yet. If you cannot phrase one as an observable
WHEN/THEN, the requirement is not specified — it is a wish.

A task names the requirement it serves and how you will know it is done:

```markdown
- [ ] 2.1 Reject expired sessions in the refresh handler
      Covers: Session timeout, Token refresh
      Depends: 1.2
      Verify: `pnpm test auth-refresh` passes with the new expiry case
```

## The workflow

| Step | Produces | Done when |
|---|---|---|
| 1. Orient | — | You can name the capabilities in play and the change id |
| 2. Grill | rulings | Every open decision is answered or recorded with its cost if wrong |
| 3. Propose | `proposal.md` | **User approves the capability list** |
| 4. Specify | deltas | Every requirement has ≥1 scenario; validator clean |
| 5. Design | `design.md` *(conditional)* | Decisions resolved, or stated why it is skipped |
| 6. Plan | `tasks.md` | Every requirement covered; dependency graph acyclic |
| 7. Implement | code | Every box ticked after reading its verification output |
| 8. Verify | report | Every requirement maps to evidence run and read this session |
| 9. Archive | merged specs | Canonical specs updated; plan archived; validator clean |

Before starting, the workflow routes itself. A rename, a typo, a dependency bump, or a bug
with one obvious cause is **declined** — it says so and stops, rather than spending an hour
producing documents for a one-line change.

`SKILL.md` also carries a failure-mode table and a red-flags list, because the interesting
failures here are not "the agent cannot do it" — they are the moments an agent talks itself
out of the gate.

## The validator

```sh
node skills/eagle-sdd/scripts/validate.mjs              # defaults to docs/eagle-sdd
node skills/eagle-sdd/scripts/validate.mjs path/to/tree
node skills/eagle-sdd/scripts/validate.mjs --help
```

Zero dependencies, Node 18+. Exits `1` on any error. **31 codes — 28 errors, 3 warnings.**
A sample of what it catches:

| Code | Caught |
|---|---|
| `D001` | A proposal declares a capability that has no delta file |
| `D011` | A `MODIFIED` requirement silently drops a scenario the canonical spec still has |
| `D005` | A scenario header uses three hashes instead of four |
| `P004` | Observable behavior changes but no capability is declared |
| `T007` | A requirement is covered by no task |
| `T004` | A task covers a name that resolves to no requirement |
| `T006` | The dependency graph has a cycle |
| `C001` | A delta was written directly into the canonical specs |

The full list lives in
[`references/artifacts.md`](skills/eagle-sdd/references/artifacts.md#validation-errors).

**The validator is optional.** The workflow runs on the checklist alone; the script is an
accelerator for when you have Node. It is a real check, though — the test suite proves every
one of the 31 codes actually fires, and that the reference documents exactly those codes and
no others.

## Harness support

Skills are written to name **actions**, never tools — "ask the user a structured question",
not `AskUserQuestion` — so one body runs everywhere.
[`references/harnesses.md`](skills/eagle-sdd/references/harnesses.md) holds the per-harness
translation.

| Harness | Skill roots | Structured question tool |
|---|---|---|
| Claude Code | `.claude/skills/`, `~/.claude/skills/` | `AskUserQuestion` |
| Codex CLI | `.agents/skills/`, `~/.agents/skills/` | none — prose fallback |
| DeepSeek Harness | `.agents/skills/`, `.dsh/skills/`, and their `~` equivalents | `ask_user_question` |
| Copilot CLI | `.agents/skills/`, `~/.copilot/skills/`, `.github/skills/` | — |
| Gemini CLI | `.agents/skills/`, `~/.gemini/skills/` | — |

`~/.agents/skills/` is the interoperable location — everything except Claude Code reads it,
which is why the installer writes two links.

Manual invocation is enforced three ways, because the harnesses read different places:

| Harness | Mechanism |
|---|---|
| Claude Code, DeepSeek Harness | `disable-model-invocation: true` in frontmatter |
| Codex | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` |
| Anything else | the description marks it explicitly-invoked-only |

`disable-model-invocation` is outside the six portable [Agent Skills](https://agentskills.io)
fields. It is included deliberately, and a test asserts the field budget stays exactly at that
one addition.

## Repository layout

```
skills/eagle-sdd/
├── SKILL.md                    the workflow spine: steps, gates, failure modes (222 lines)
├── references/
│   ├── artifacts.md            file grammar, delta operations, every error code
│   ├── verification.md         the evidence gate and the review protocol
│   └── harnesses.md            action → tool mapping per harness
├── assets/templates/           proposal, spec, design, tasks
├── scripts/validate.mjs        zero-dependency structural validator
└── agents/openai.yaml          Codex invocation policy
scripts/                        installers for each harness's skill root
tests/                          45 Node tests
docs/eagle-sdd/                 this project's own specs, written with the skill itself
docs/research/                  primary-source notes behind the design
```

`SKILL.md` holds the procedure and points at everything else. The references load only when
the step that needs them runs, which keeps the spine readable and the always-loaded cost low.

## Design and provenance

The design is not invented from scratch. Three systems were studied from primary sources —
cloned repositories and official documentation, not summaries — and the notes are checked in:

| Note | What it contributed |
|---|---|
| [`docs/research/openspec.md`](docs/research/openspec.md) | The canonical/delta split, the `Requirement`/`Scenario` grammar, the archive merge order — and the critique that motivated the coverage check: nothing in that design verifies a proposal's promises ever became requirements. |
| [`docs/research/superpowers.md`](docs/research/superpowers.md) | Skill mechanics; why a `description` must state *when* and never *what*; the measured finding that prohibitions backfire on output-shaping problems while positive recipes converge. |
| [`docs/research/mimo-compose-mode.md`](docs/research/mimo-compose-mode.md) | Gates as tool calls rather than prose; stable anchors; the evidence gate; a single source of truth per change. |

Two findings worth knowing, because they look like style choices and are not:

- **A `description` that summarises the workflow becomes a shortcut the agent takes.** A
  measured failure: a description saying "code review between tasks" made the agent do *one*
  review, while the body specified two. Triggering conditions only.
- **Prohibitions backfire when the problem is the shape of the output.** In head-to-head
  wording tests, the prohibition arm produced *more* of the unwanted content than a
  no-guidance control. This skill uses prohibitions only for discipline failures — the moments
  an agent knows the rule and skips it under pressure — and positive recipes everywhere else.

This repository practices what it ships: its own behaviour is specified in
[`docs/eagle-sdd/specs/spec-driven-workflow/spec.md`](docs/eagle-sdd/specs/spec-driven-workflow/spec.md),
in the same format the skill produces.

## Development

```sh
node --test                            # 45 cases across both suites
node --test tests/validate.test.mjs    # 34 cases — one per validator error code
node --test tests/skill.test.mjs       # 11 cases — frontmatter and bundle integrity
npm run validate                       # validate this repo's own specs
```

The skill suite enforces the properties that decide whether the skill loads at all: valid
frontmatter, the portable field budget, the manual-invocation policy, `SKILL.md` under 500
lines, every referenced file present, and that the documented error codes and the emitted ones
match **in both directions**.

Contributions should keep `node --test` and `npm run validate` green. See
[`AGENTS.md`](AGENTS.md) for the rules that apply to editing the skill itself.

## License

MIT
