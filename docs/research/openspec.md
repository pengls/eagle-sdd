# OpenSpec — Primary-Source Research Note

**Subject:** OpenSpec, the spec-driven-development (SDD) tool for AI coding agents.
**Method:** `git clone --depth 1 https://github.com/Fission-AI/OpenSpec.git`, then read local files with file tools. `raw.githubusercontent.com` is DNS-blocked in this environment, so every file content below comes from that clone.

| Field | Value |
|---|---|
| Repo | https://github.com/Fission-AI/OpenSpec |
| Commit inspected | `9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461` (`main`, "Version Packages (#1822)") |
| Package version | `1.13.0` |
| npm package | `@fission-ai/openspec` — https://www.npmjs.com/package/@fission-ai/openspec |
| Official site | https://openspec.dev/ (declared as `homepage` by the GitHub API) |
| License / stack | MIT; TypeScript, ESM, Node ≥ 20.19.0, Commander.js |

**On "rebrand/rename" and the npm name.** There is **no project rename**: org is still `Fission-AI`, repo still `OpenSpec`, npm package still `@fission-ai/openspec`. What was renamed is the **workflow and its slash-command namespace** — legacy `/openspec:*` became **OPSX** `/opsx:*` (see `docs/opsx.md`, `docs/migration-guide.md`). Separately, the bare npm name `openspec` is an unrelated `0.0.0` placeholder from a different owner (`openspecio/openspec`) — only the `@fission-ai` scope is this tool.

---

## Summary

OpenSpec is two deliberately separated halves:

1. **A CLI (`openspec`) — the "engine".** Owns the rules: what a change folder looks like, which artifacts depend on which, whether a delta is well-formed, and how a delta merges into the canonical spec. Deterministic, tool-agnostic.
2. **Slash commands / skills (`/opsx:*`) — the "steering wheel".** Prompt files that `openspec init` writes into whatever AI tool you use. They encode the *agent loop behaviour* (draft, read dependencies, implement, pause on ambiguity, archive). Nothing enforces them; they are instructions.

The core idea: **`specs/` is the source of truth, and changes are stored as deltas** (`## ADDED / MODIFIED / REMOVED / RENAMED Requirements`) folded into the canonical spec only at **archive** time. That is what makes it brownfield-first — you never document the whole system up front, only the diff each change touches. Format is minimal plain Markdown (`### Requirement:` / `#### Scenario:`), and the validator is strict about only a handful of things.

---

## CLI & workflow loop

### The two halves (verbatim, `docs/how-commands-work.md`)

> **The one thing to know: OpenSpec has two kinds of commands, and they run in two different places.** `openspec ...` commands run in your **terminal**; `/opsx:...` commands run in your **AI assistant's chat**.

> The CLI is the **engine**. It knows the rules: what a change folder looks like, which artifacts depend on which, how to merge a delta spec into your source of truth. It's the same everywhere. The slash commands are the **steering wheel**, and every AI tool has a slightly different one.

### The loop (verbatim, `docs/how-commands-work.md`)

```text
TERMINAL   $ npm install -g @fission-ai/openspec@latest
TERMINAL   $ cd your-project
TERMINAL   $ openspec init          (installs slash commands into your AI tool)

AI CHAT      /opsx:explore          (optional: think it through first)
AI CHAT      /opsx:propose add-dark-mode   (AI drafts proposal, specs, design, tasks)
AI CHAT      /opsx:apply            (AI builds it, checking off tasks)
AI CHAT      /opsx:archive          (merged into specs and filed away)
```

### CLI surface (`docs/cli.md`)

Setup `init`/`update` · Browsing `list`/`view`/`show` · Validation `validate` · Lifecycle `archive` · Workflow `new change`/`status`/`instructions`/`templates`/`schemas` · Schemas `schema init|fork|validate|which` · Stores (beta) `store *`/`context`/`workset *` · Config/utility `config`/`feedback`/`completion`/`doctor`.

Human-only (interactive): `init`, `view`, `workset open`, `config edit`, `feedback`, `completion install`. Agent-compatible (`--json`): `list`, `show`, `validate`, `status`, `instructions`, `templates`, `schemas`, `store *`, `new change`, `workset create/list/remove`. The three that carry the agent loop: `openspec status --change <name> --json` (artifact completion, dependency edges, `applyRequires`, `planningHome`, `changeRoot`, `artifactPaths`, `actionContext`); `openspec instructions <artifact-id> --change <name> --json` (**authoritative** guidance: `template`, `instruction`, `context`, `rules`, `resolvedOutputPath`, `dependencies`, `skipped`/`warning`); and `openspec validate --all --json` / `openspec archive <name> --yes`.

### What the CLI enforces vs what only the agent does

| Concern | CLI | Agent-only |
|---|---|---|
| Change name is lowercase kebab-case | ✅ `openspec new change` | — |
| Artifact existence / dependency order | ✅ `status` computes it | Agent must *choose* to walk the required set transitively |
| Delta sections parse; body has `SHALL`/`MUST`; ≥1 scenario | ✅ `validate` | — |
| Merging deltas into main specs | ✅ `archive` (deterministic) | `/opsx:sync` is a **separate agent-driven** intelligent merge |
| "Don't implement during planning" | ❌ | ✅ hard rule in the propose skill |
| "Pause on ambiguity; don't silently narrow scope" | ❌ | ✅ hard rule in the apply skill |

`docs/cli.md` is explicit that injected context/rules are *"behavioral contracts for generated agents, not enforceable CLI checks."*

**Archive steps (verbatim, `docs/cli.md`):** (1) validate unless `--no-validate`; (2) confirm unless `--yes`; (3) claim the archive destination before changing any main spec; (4) validate and merge deltas into `openspec/specs/`; (5) move the change to `changes/archive/YYYY-MM-DD-<name>/`; (6) on failure before a complete archive is secured, restore specs and return the change to its active path. Without a terminal it *"stops before touching anything, exits 1, and names the command to rerun — `openspec archive <name> --yes`"*.

---

## On-disk artifact model

### Written by `openspec init` (verbatim, `docs/cli.md`)

```
openspec/
├── specs/              # Your specifications (source of truth)
├── changes/            # Proposed changes
└── config.yaml         # Project configuration

.claude/skills/  .cursor/skills/  .cursor/commands/  .agents/skills/
                        # per-tool skills + OPSX commands for the tools you selected
```

### Change folder (verbatim, `docs/concepts.md`)

```
openspec/changes/add-dark-mode/
├── proposal.md           # Why and what
├── design.md             # How (technical approach)
├── tasks.md              # Implementation checklist
├── .openspec.yaml        # Change metadata (optional): schema, created, skip_specs, retire_capabilities
└── specs/ui/spec.md      # Delta spec: what's changing in ui/spec.md
```

Confirmed in-repo: `openspec/changes/add-validation-findings-report/` contains exactly `.openspec.yaml`, `design.md`, `proposal.md`, `tasks.md`, `specs/cli-validate/spec.md`. Its `.openspec.yaml` is `schema: spec-driven` + `created: 2026-08-21`.

### CORRECTION: `openspec/project.md` and `openspec/AGENTS.md` are LEGACY

The brief guessed at `openspec/project.md`. **It is no longer part of the model.** `docs/migration-guide.md`:

> **`openspec/project.md`** — This file isn't deleted automatically because it may contain project context you've written. You'll need to: 1. Review its contents 2. Move useful context to `openspec/config.yaml` … 3. Delete the file when ready
> | `openspec/AGENTS.md` | Obsolete workflow trigger |

And `src/core/templates/index.ts`: *"The old config file templates (AGENTS.md, project.md, claude-template, etc.) have been removed. The skill-based workflow uses skill-templates.ts directly."*

One *current* spec still documents the old tree — `openspec/specs/openspec-conventions/spec.md` "Requirement: Project Structure" lists `project.md` and `AGENTS.md` under `openspec/` and calls `changes/<name>/specs/` "Complete future state", contradicting the live delta model. **Treat that spec as stale documentation of the pre-delta design.** [inference — grounded in `docs/concepts.md`, the schema instructions, and `src/core/specs-apply.ts`]

### Project config — `openspec/config.yaml` (repo root, abridged)

```yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, Node.js (≥20.19.0), ESM modules
  ...

rules:
  specs:
    - Include scenarios for Windows path handling when dealing with file paths
  tasks:
    - Add Windows CI verification as a task when changes involve file paths
```

`context` (free text, injected into every artifact instruction) and `rules` (keyed per artifact ID) replace the legacy `project.md`. Schema precedence (`docs/opsx.md`): CLI `--schema` → change `.openspec.yaml` → project `config.yaml` → default `spec-driven`.

### Real change proposal, VERBATIM (complete file)

`openspec/changes/fix-cli-local-date-semantics/proposal.md`:
```markdown
## Why

Two CLI code paths currently derive date-only values by truncating a UTC ISO timestamp: archive directory prefixes and the `created` field in newly scaffolded change metadata. Near a local midnight boundary, these values can resolve to the previous or next calendar date instead of the date in the CLI process's effective local time zone.

## What Changes

- Define CLI-generated date-only values as the calendar date in the effective local time zone of the Node.js process executing the CLI, formatted as `YYYY-MM-DD`.
- Generate CLI archive directory names from that local date.
- Record the same local date in the `created` field of newly created change metadata.
- Add regression coverage for a non-UTC local-date boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-archive`: archive target names use the CLI process's effective local calendar date.
- `change-creation`: newly created change metadata records the CLI process's effective local calendar date.

## Impact

- Affected code: archive naming, change-creation metadata, and a shared date-only formatter.
- Affected tests: archive and change-creation coverage.
- Existing archive directories remain unchanged; the rule applies to newly generated names and metadata only.
```

### Real delta spec, VERBATIM (complete file)

`openspec/changes/fix-cli-local-date-semantics/specs/change-creation/spec.md`:

```markdown
## ADDED Requirements

### Requirement: Local Creation Date Metadata

The system SHALL record the `created` value in metadata for a newly created change as the `YYYY-MM-DD` calendar date in the effective local time zone of the Node.js process executing the CLI.

#### Scenario: Create change across a UTC date boundary

- **GIVEN** the CLI process's effective local time zone is `Asia/Shanghai`
- **AND** the current instant is `2026-07-14T16:30:00.000Z`
- **WHEN** the user creates a change
- **THEN** the new change's `.openspec.yaml` contains `created: 2026-07-15`
```

### Delta spec showing MODIFIED, VERBATIM excerpt

From `openspec/changes/add-validation-findings-report/specs/cli-validate/spec.md` (lines 183–193; the full file is 260 lines with ~20 ADDED scenarios and 2 MODIFIED requirements):

```markdown
## MODIFIED Requirements

### Requirement: Bulk and filtered validation

The validate command SHALL support flags for bulk validation (--all) and filtered validation by type (--changes, --specs). These flags SHALL select the same items for full and findings reports. Complete per-item listings SHALL apply when `--report` is omitted or is `full`; findings output SHALL follow the item-findings report contract.

#### Scenario: Validate everything

- **WHEN** executing `openspec validate --all`
- **THEN** validate all changes in openspec/changes/ (excluding archive)
- **AND** validate all specs in openspec/specs/
```

Note the pattern: a MODIFIED block **restates the entire requirement** (body + every surviving scenario) — it is not a diff. A `## RENAMED Requirements` section uses `- FROM:` / `- TO:` lines.

### Canonical (main) spec, VERBATIM excerpt

`openspec/specs/cli-validate/spec.md`, lines 1–12:

```markdown
# cli-validate Specification

## Purpose
Define `openspec validate` behavior for validating changes and specs with actionable remediation guidance and structured output.

## Requirements
### Requirement: Validation SHALL provide actionable remediation steps
Validation output SHALL include specific guidance to fix each error, including expected structure, example headers, and suggested commands to verify fixes.

#### Scenario: No deltas found in change
- **WHEN** validating a change with zero parsed deltas
- **THEN** show error "No deltas found" with guidance:
```

Structure: `# <capability> Specification` → `## Purpose` → `## Requirements` → N × (`### Requirement:` + body + `#### Scenario:`). Main specs **must never contain delta headers** (`src/core/parsers/spec-structure.ts` flags them as errors).

### Delta sections and archive behaviour (verbatim table, `docs/concepts.md`)

| Section | Meaning | What Happens on Archive |
|---|---|---|
| `## ADDED Requirements` | New behavior | Appended to main spec |
| `## MODIFIED Requirements` | Changed behavior | Replaces existing requirement |
| `## REMOVED Requirements` | Deprecated behavior | Deleted; removing the last requirement retires the capability and deletes its spec file, when the change declares `retire_capabilities: true` |
| `## Purpose` | What a brand-new capability is for | Seeds the Purpose of the main spec being created; ignored when the spec already exists |

### Archive merge — exact order and rules

`src/core/specs-apply.ts` (the deterministic path used by `openspec archive`):

```ts
// Apply operations in order: RENAMED → REMOVED → MODIFIED → ADDED
```

Matching is by header name — `normalize(header) = trim(header)`, case-sensitive after normalization (`openspec-conventions`). Rules encoded in code and specs: target spec doesn't exist → **only ADDED allowed** (MODIFIED/RENAMED throw, REMOVED warns and is ignored); a delta `## Purpose` only seeds a **new** spec; REMOVED already absent = already removed, while case/whitespace near-misses are conflicts; ADDED with identical content = already synced, differing content = conflict; RENAMED with source gone but target present = already synced; the main spec is structurally validated first and delta headers in it abort the merge.

**Two merge implementations exist and differ.** `openspec archive` merges programmatically and deterministically. `/opsx:sync` is an **agent-driven intelligent merge** — `skills/openspec-sync-specs/SKILL.md`: *"you will read delta specs and directly edit main specs to apply the changes. This allows intelligent merging (e.g., adding a scenario without copying the entire requirement)."* `/opsx:archive` runs that skill *inline*, then re-verifies by re-comparing every capability. `validator.ts` also reuses archive's builder as a dry run, so authoring-time validation reports what archive would refuse.

---

## Requirement / Scenario format & validation rules

### Syntax

```markdown
## ADDED Requirements               <- delta section header (changes only)
### Requirement: Session Timeout     <- level-3 header + name
The system SHALL expire a session after 30 minutes of inactivity.   <- body with SHALL/MUST
#### Scenario: Idle timeout          <- exactly FOUR hashtags
- **GIVEN** an authenticated session
- **WHEN** 30 minutes pass with no activity
- **THEN** the session is invalidated and the user must re-authenticate
```

Authoritative rules, verbatim from `schemas/spec-driven/schema.yaml` (the `specs` artifact instruction):

> - Each requirement: `### Requirement: <name>` followed by description
> - Use SHALL/MUST for normative requirements (avoid should/may)
> - Each scenario: `#### Scenario: <name>` with WHEN/THEN format
> - **CRITICAL**: Scenarios MUST use exactly 4 hashtags (`####`). Using 3 hashtags or bullets will fail silently.
> - Every requirement MUST have at least one scenario.

The keyword must be on the **body line immediately after the header** — `validator.ts` has a dedicated message: *"…must contain SHALL or MUST in the requirement body, not only in the header. Move the SHALL/MUST statement to the line immediately after the "### Requirement: ..." header."* REMOVED entries must carry `**Reason**` and `**Migration**` (schema instruction). RENAMED syntax:

```markdown
## RENAMED Requirements
- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

### What makes validation FAIL

Levels are `ERROR` / `WARNING` / `INFO`. Default validity = **zero errors**; `--strict` = zero errors *and* zero warnings (`src/core/validation/validator.ts`).

**ERRORs** (from `validator.ts`, `constants.ts`, `parsers/spec-structure.ts`):

- Delta at `specs/spec.md` (no capability folder) — it *"is ignored when the change is applied or archived."*
- Zero deltas in a change, unless `.openspec.yaml` has `skip_specs: true`; and `skip_specs: true` **with** files under `specs/`.
- A delta section present but no `### Requirement:` blocks parsed; or no delta sections at all in a delta spec file.
- ADDED/MODIFIED requirement with no body text, or **fewer than one scenario**.
- Duplicate requirement name within ADDED / MODIFIED / REMOVED / RENAMED; and cross-section conflicts (MODIFIED+REMOVED, MODIFIED+ADDED, ADDED+REMOVED, RENAMED+REMOVED).
- MODIFIED references the old name of a RENAMED; RENAMED TO collides with ADDED.
- MODIFIED omits a scenario the current main spec still has — *"archive refuses to drop them."*
- Main spec contains delta headers, a requirement outside `## Requirements`, or a duplicate requirement name.
- Missing `## Purpose`/`## Requirements` (spec) or `## Why`/`## What Changes` (proposal) — Zod `SpecSchema`/`ChangeSchema`.

**WARNINGs (fail only under `--strict`):** requirement body without literal `SHALL`/`MUST` (*"RFC 2119 best practice for English specs"*); main-spec `## Purpose` under 50 chars or still a placeholder (`TBD - created by archiving change …. Update Purpose after archive.`); main-spec requirement with no scenarios; delta description < 10 chars; ADDED/MODIFIED delta with no requirements; task-numbering issues; proposal `## Why` < 50 chars.

**INFO:** requirement text > 500 chars; stray non-`### Requirement:` level-3 headers inside delta sections; archive dry-run conflicts.

**Thresholds (`constants.ts`):** `MIN_WHY_SECTION_LENGTH = 50`, `MIN_PURPOSE_LENGTH = 50`, `MAX_WHY_SECTION_LENGTH = 1000`, `MAX_REQUIREMENT_TEXT_LENGTH = 500`, `MAX_DELTAS_PER_CHANGE = 10`. `--archived` is a separate scope: it does **not** validate deltas; it checks that every change under `changes/archive/` has all `tasks.md` checkboxes ticked (pre-commit linting).

---

## Agent instruction files

The **canonical source of truth in the repo** is `skills/openspec-*/SKILL.md`; `openspec init` renders these into each tool's path. Shared frontmatter:

```yaml
---
name: openspec-propose
description: Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata: { author: openspec, version: "1.0" }
---
```

12 skills ship: `openspec-explore`, `-propose`, `-new-change`, `-continue-change`, `-ff-change`, `-apply-change`, `-update-change`, `-sync-specs`, `-verify-change`, `-archive-change`, `-bulk-archive-change`, `-onboard`.

**Root `AGENTS.md` / `CLAUDE.md` are NOT written by OPSX.** They were legacy marker-block carriers; `src/core/legacy-cleanup.ts` lists `CLAUDE.md`, `AGENTS.md`, `QWEN.md`, `IFLOW.md`, `CODER.md` … under `LEGACY_CONFIG_FILES` and only strips OpenSpec's marker blocks — *"Config files like CLAUDE.md, AGENTS.md are NEVER deleted."*

**`openspec-propose` — the load-bearing bits, verbatim:**

> **Planning boundary**: This workflow creates planning artifacts only. The user request that selected or triggered this workflow authorizes planning only, even if it asks to build or fix something. Do not edit project code. After the planning artifacts are complete, stop. Do not start implementation in the same response, even if the initial request asks for it.

> 1. … If the request contains ambiguity that would materially affect scope, externally observable behavior, compatibility, or acceptance criteria, ask the user before creating the change. For minor details, make a reasonable assumption and record it in the planning artifacts.

> 2. **Load project context** — Run `openspec context --json` … Use the returned `root.path` as the authoritative OpenSpec root. If context reports `no_openspec_root`, stop without creating or changing any files.

> 6.b … The required set is `applyRequires` plus every artifact reachable from those by following the `requires` edges in `status --json` — walk them transitively … `status` is file-existence only, so an `applyRequires` artifact reading `done` does NOT mean its dependencies exist — writing `tasks.md` early marks `tasks` done while `specs` was never written. Use each artifact's `requires` edges, not its `status`, to build the required set. … Dependencies are enablers, not gates.

> - Always read dependency artifacts before creating a new one - re-read from disk, not from conversation memory (files may have changed since you last saw them)
> - **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file … Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact

**`openspec-apply-change` — enforcement the CLI can't provide, verbatim:**

> 6. … For each pending task: Show which task is being worked on; Make the code changes required; Keep changes minimal and focused; Mark task complete in the tasks file: `- [ ]` → `- [x]`; Continue to next task.
> **Pause if:** Task is unclear → ask for clarification; Implementation reveals a design issue → suggest updating artifacts; A task needs work beyond what the spec and tasks describe, or you are tempted to drop, narrow, defer, or accept exceptions to specified behavior to make it fit → surface the added scope and ask; do not absorb it silently.
> - Only mark a task `- [x]` when its specified behavior is fully implemented, not when it is partially done or deferred
> - **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions … not phase-locked, work fluidly

**`openspec-archive-change` — the cross-check discipline, verbatim:**

> 3. **Check task completion status** … Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete). **If incomplete tasks found:** Display warning … Ask the user to confirm they want to proceed.

> 4. … Then re-run the comparison … against every capability that has a delta spec … A successful sync leaves nothing left to apply, so each capability must now read as already synced … **If the sync failed, or any capability does not match, report what differs and stop — do not archive.**
> - Never archive while a spec sync is still in flight — run the sync inline and verify the main specs before moving `changeRoot`

The pattern worth stealing: **the agent performs the merge, then independently re-verifies the merge before taking the irreversible step.** `openspec-sync-specs` adds: *"Unlike programmatic merging, you merge rather than overwrite … Keep anything the delta does not mention, in the main spec's existing order"* and *"The operation should be idempotent - running twice should give same result."*

**One more generated artifact:** `docs/installation.md` ships a paste-into-your-assistant setup prompt — a template for a defensive agent instruction that stops at privilege boundaries: *"If Node is missing or older, say so and stop — don't install Node, switch versions, or reconfigure my version manager for me."* … *"Never edit my shell startup files (.bashrc, .zshrc, .profile, fish, PowerShell profile)."*

---

## Multi-tool portability strategy

**One workflow, N thin renderers:**

1. **One canonical skill body per workflow** (`skills/openspec-<x>/SKILL.md`; generated from `src/core/templates/workflows/*.ts`).
2. **A command-generation adapter per tool** (`src/core/command-generation/adapters/<tool>.ts`, ~40 files) that decides only *file path* + *frontmatter format*:

```ts
export const cursorAdapter: ToolCommandAdapter = {
  toolId: 'cursor',
  getFilePath: (id) => path.join('.cursor', 'commands', `opsx-${id}.md`),
  formatFile: (content) => `---
name: ${escapeYamlValue(`/opsx-${content.id}`)}
category: ${escapeYamlValue(content.category)}
---

${content.body}
`,
};
```

3. **Tool metadata table** (`AI_TOOLS` in `src/core/config.ts`, mirrored in `docs/supported-tools.md`) holding skill path + command path per tool.
4. **Delivery modes** `skills` | `commands` | `both`; profiles `core` (propose, explore, apply, update, sync, archive) or expanded (adds new, continue, ff, verify, bulk-archive, onboard), applied via `openspec config profile` then `openspec update`.

**The invocation name is derived from the file shape, not hardcoded.** Verbatim from `docs/supported-tools.md`:

| Command file OpenSpec writes | You type | Tools |
|---|---|---|
| `.../commands/opsx/<id>.*` — an `opsx/` folder namespaces it | `/opsx:<id>` | Claude Code, CodeBuddy, Crush, Gemini CLI, Lingma, Qoder, ZCode |
| `.../opsx-<id>.*` — the filename is the command | `/opsx-<id>` | Every other tool with generated command files, except Amazon Q and Devin |
| `.amazonq/prompts/opsx-<id>.md` — a prompt, not a command | `@opsx-<id>` | Amazon Q Developer |
| none — skills only | `/openspec-<skill>` | CodeArts, ForgeCode, Hermes, MiniMax Code, Mistral Vibe, Zed Agent, shared `.agents` |
| none — Kimi Code | `/skill:openspec-<skill>` | Kimi Code |
| none — Codex CLI | `$openspec-<skill>` | Codex |

**Key insight:** skill *names* and command *ids* are deliberately **not** 1:1 (`/opsx:apply` is the `openspec-apply-change` skill). Because skills-only tools have no commands, generated bodies cross-reference other workflows by **skill name** wherever a tool might be skills-only. Devin is the documented hard case (Desktop reads `.devin/workflows/`, Devin Local reads only skills), so those bodies use `/openspec-*` skill invocations that work on both. Also worth copying: `openspec init` prints the correct invocation form at the end, so the docs never have to be the authority — *"read the 'Getting started' line `openspec init` printed: it already uses the form your tools registered."*

---

## Design rationale

### Why split `specs/` from `changes/` (verbatim, `docs/concepts.md`)

> **Specs** are the source of truth — they describe how your system currently behaves. **Changes** are proposed modifications — they live in separate folders until you're ready to merge them. This separation is key. You can work on multiple changes in parallel without conflicts. You can review a change before it affects the main specs. And when you archive a change, its deltas merge cleanly into the source of truth.

Four stated benefits of "changes are folders": everything together; parallel work; clean history (the archive preserves *why*); review-friendly. Why deltas instead of full specs: **Clarity** ("Reading a full spec, you'd have to diff it mentally"), **Conflict avoidance** ("Two changes can touch the same spec file without conflicting, as long as they modify different requirements"), **Review efficiency**, **Brownfield fit**.

### How it keeps context small

Engineered, not incidental:

- The `proposal` artifact instruction tells the agent to run `openspec list --specs`, then `openspec show "<spec-id>" --type spec --json --no-scenarios` — *"that returns a capability's purpose and requirement texts without pulling whole spec files into context"* — and only then read full specs for the ones that matter. Store references likewise resolve to an **index**: *"spec content is never copied into the output."*
- `openspec show` has `--deltas-only`, `--requirements`, `--no-scenarios`, `-r <index>` for selective reads.
- Change size is capped in guidance: `MAX_DELTAS_PER_CHANGE = 10` → *"Consider splitting changes with more than 10 deltas"*; `docs/writing-specs.md` calls an over-broad change *"the single most common authoring mistake."*
- README: *"OpenSpec benefits from a clean context window. Clear your context before starting implementation."* FAQ: because the plan lives in files, *"you can clear your context, start a fresh AI session, and pick up with `/opsx:apply`."*
- Even the new `--report findings` validate mode exists to shrink agent context: the change proposal cites a 157,396-byte full JSON report vs a 6,740-byte findings envelope (95.7% smaller).

### Brownfield vs greenfield

`docs/faq.md`: *"Existing codebases are the main event. OpenSpec is brownfield-first: you do not document your whole app up front. You write specs only for what each change touches, and your specs fill in over time around the work you actually do."* Mechanically: deltas make modification first-class; `openspec show`'s filtered reads find the right existing capability without reading everything; archive's MODIFIED scenario-loss check stops a lazy delta from silently dropping existing spec content.

### Self-acknowledged tradeoffs

> **The strength here is honesty:** real work is messy and iterative, and OpenSpec lets it be. **The tradeoff is discipline:** because nothing forces you forward, it's on you to keep a change focused rather than letting it sprawl. **The tradeoff:** because context is injected into every request, you'll want to be concise. And the honest tradeoff: for a truly trivial one-line fix, the ceremony may not pay off, and that's fine.

---

## Critique

### Credible, primary-source failure modes

**1. Specs are never cross-checked against the proposal.** GitHub issue [#687 "Incomplete specs after proposal"](https://github.com/Fission-AI/OpenSpec/issues/687) (open, labelled `design-review`). Reporter's words (Spanish, translated): `/opsx:ff` generates artifacts quickly but has no cross-reference step against the source document; `/opsx:verify` is post-implementation (code vs specs), not specs vs proposal; and *"there is nothing that validates that the specs exhaustively cover the proposal."* Their workaround was authoring a new `/opsx:audit` skill. This is the sharpest criticism of the artifact model: **the proposal→specs pipeline is write-only.** Nothing checks that a proposal's stated change actually became a delta.

**2. Same class, self-documented.** The validator's checks are *structural*, not *semantic* — they confirm a requirement exists and has a scenario, never that it is the right requirement. `validator.ts` comments confirm INFO-level findings (e.g. a MODIFIED naming a header that doesn't exist yet) deliberately do not change the verdict, because "a missing target can be a typo or a requirement introduced by a sibling change that has not archived yet." The schema instruction likewise warns that 3-hashtag scenarios *"will fail silently"*, and `spec-structure.ts` exists to catch delta headers leaking into main specs, requirements outside `## Requirements`, and duplicate names — cases where a document looks fine to a human but is invisible to `validate`, `list`, and `archive`.

**3. Documentation drift inside the repo.** The current `openspec/specs/openspec-conventions/spec.md` still documents `openspec/project.md`, `openspec/AGENTS.md`, and `changes/<name>/specs/` as "Complete future state" — all three contradicted by the live delta model and `docs/migration-guide.md`. [inference]

**4. Community friction signals** (top open issues by reactions, `main`): custom `openspec/` directory path (#697 with 27 reactions, #664, #1141 — the hardcoded root is a recurring complaint), multi-repo/microservice spec management (#725), reverse-engineering specs from existing code (#724 — code-first adoption is missing), delta specs retaining "evolutionary" language after merge (#678), and *"Hardcoded spec format prevents custom schemas from working"* (#666) — which partially undercuts the schema-customisation pitch.

**5. The two-merge-paths asymmetry is a real correctness risk, and the project knows it.** `openspec archive` merges deterministically; `/opsx:sync` merges by model judgement. The archive skill has to add explicit re-verification plus an "idempotent" requirement on the sync skill to compensate, and warns *"Never archive while a spec sync is still in flight."* That is prompt-enforced, not code-enforced.

### Secondary sources are heavily contaminated — treat with suspicion

Two popular "OpenSpec reviews" are **not about this tool**:

- [openaitoolshub.org "OpenSpec Review"](https://www.openaitoolshub.org/en/blog/openspec-review) calls OpenSpec "an AI-powered API specification generator" producing "OpenAPI 3.x output", installed via `git clone … ~/.claude/skills/openspec`, with a web UI at `openspec.pro` and a command `/openspec src/api/routes/ipo-data.ts`. **None of that matches the primary source** — no OpenAPI output, no `openspec.pro` (it is `openspec.dev`), no such command. Its numbers ("60–70% of the spec work done automatically") have no basis in the repo.
- [chyshkala.com "Overkill?"](https://chyshkala.com/blog/why-openspec-s-structured-ai-development-might-be-overkill-for-your-next-project) shows a layout with `changes/deltas/` and a JSON delta `{"type":"MODIFIED","file":"user-service.ts", …}` — neither exists. Its direction (a single `Instructions.md` beating the ceremony on simple changes) is a fair argument, but its artifacts are invented.

Reusable lesson: secondary "OpenSpec" content is frequently about a different project or hallucinated. Cite the repo.

---

## Sources

**Primary — repo at `9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461` (`main`), read from a local `git clone --depth 1`.** All under https://github.com/Fission-AI/OpenSpec/: metadata via [GitHub API](https://api.github.com/repos/Fission-AI/OpenSpec); `README.md`; `docs/` → [`concepts.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md), [`overview.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/overview.md), [`cli.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md), [`how-commands-work.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/how-commands-work.md), [`writing-specs.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/writing-specs.md), [`supported-tools.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md), [`migration-guide.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/migration-guide.md), [`opsx.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/opsx.md), [`installation.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md), [`faq.md`](https://github.com/Fission-AI/OpenSpec/blob/main/docs/faq.md); [`schemas/spec-driven/schema.yaml`](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/schema.yaml) and its `templates/`; `skills/openspec-{propose,apply-change,archive-change,sync-specs}/SKILL.md`; real changes [`openspec/changes/fix-cli-local-date-semantics/`](https://github.com/Fission-AI/OpenSpec/tree/main/openspec/changes/fix-cli-local-date-semantics) and [`openspec/changes/add-validation-findings-report/`](https://github.com/Fission-AI/OpenSpec/tree/main/openspec/changes/add-validation-findings-report); real specs [`openspec/specs/cli-validate/spec.md`](https://github.com/Fission-AI/OpenSpec/blob/main/openspec/specs/cli-validate/spec.md) and [`openspec-conventions/spec.md`](https://github.com/Fission-AI/OpenSpec/blob/main/openspec/specs/openspec-conventions/spec.md) (partly stale); source `src/core/{validation/validator.ts, validation/constants.ts, parsers/spec-structure.ts, specs-apply.ts, legacy-cleanup.ts, templates/index.ts, command-generation/adapters/cursor.ts}`.

**Package / distribution:** npm [`@fission-ai/openspec`](https://www.npmjs.com/package/@fission-ai/openspec) (v1.13.0, 48 versions; [registry JSON](https://registry.npmjs.org/@fission-ai/openspec)) · bare [`openspec`](https://registry.npmjs.org/openspec) (v0.0.0, unrelated placeholder) · official site https://openspec.dev/

**Secondary — critique only, flagged where unreliable:** [issue #687](https://github.com/Fission-AI/OpenSpec/issues/687) · [top open issues by reactions](https://api.github.com/search/issues?q=repo:Fission-AI/OpenSpec+is:issue+is:open&sort=reactions) · [openaitoolshub.org review](https://www.openaitoolshub.org/en/blog/openspec-review) (**inaccurate about this tool; do not cite**) · [chyshkala.com "Overkill?"](https://chyshkala.com/blog/why-openspec-s-structured-ai-development-might-be-overkill-for-your-next-project) (shows a layout that does not exist; use only for the general ceremony-vs-scale argument)
