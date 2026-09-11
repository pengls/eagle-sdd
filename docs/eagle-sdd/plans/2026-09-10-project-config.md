# Project configuration Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Written as the record of a change that was already made and verified; every `Run:` below was executed and its output read.

**Goal:** a project states once where its documents live and whether the workflow may touch git, in `eagle-sdd.yml` at the project root; the first run asks, every later run reads it silently, and changing either is a file edit rather than a skill edit.

**Architecture:** a config layer under the existing reader. `lib/validate.mjs` gains `resolveProject`, a dependency-free `key: value` scanner, and `resolveSpecRef`'s last-resort base for a moved directory. The CLI takes its root from the config and folds config errors into its normal output. `SKILL.md` step 1 resolves the configuration before anything else and asks the two questions only when the file is absent; the plan step omits commit steps when git is off. Every literal `docs/eagle-sdd` in the skill becomes `<docs>` or an explicitly-labelled default.

**Tech Stack:** Markdown, zero-dependency Node 18+ ESM, `node:test`.

**Spec:** `docs/eagle-sdd/designs/2026-09-10-project-config-design.md`

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `skills/eagle-sdd/scripts/lib/validate.mjs` | Modify | `resolveProject`, config parsing, `F001`, resilient Spec resolution |
| `skills/eagle-sdd/scripts/validate.mjs` | Modify | Take the root from the config; report config errors |
| `skills/eagle-sdd/SKILL.md` | Modify | Resolve the config in step 1; git-conditional commit steps; `<docs>` throughout |
| `skills/eagle-sdd/references/plan-format.md` | Modify | Document the config and `F001` |
| `skills/eagle-sdd/assets/templates/*.md` | Modify | Filename comments name `<docs>` |
| `tests/validate.test.mjs` | Modify | Eleven config cases |
| `eagle-sdd.yml` | Add | This repository's own configuration |
| `README.md`, `docs/WORKFLOW.md`, `AGENTS.md` | Modify | Document the config |
| `docs/eagle-sdd/` | Add | This change's pair |

---

### Task 1: The configuration layer

**Files:**
- Modify: `skills/eagle-sdd/scripts/lib/validate.mjs`

- [x] **Step 1: Add `parseConfig` and `resolveProject`**

A `key: value` scanner handling whole-line and trailing `#` comments and quoted values; a boolean
grammar matching DSH's; upward search from the working directory for `eagle-sdd.yml`; defaults when
there is no file; an explicit argument overriding.

- [x] **Step 2: Add `F001` for a config the workflow cannot use**

An empty `docs`, or a `git` that is not a boolean. A config silently ignored is worse than one
reported.

- [x] **Step 3: Give `resolveSpecRef` a last-resort base**

The design of that name in `<root>/designs`, so moving the documents directory does not turn every
historical pair into an error.

- [x] **Step 4: Verify the library still parses and stays dependency-free**

Run: `node --check skills/eagle-sdd/scripts/lib/validate.mjs`
Expected: no output

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd/scripts/lib/validate.mjs
git commit -m "config: resolve the documents path and git setting from eagle-sdd.yml"
```

---

### Task 2: The CLI reads the config

**Files:**
- Modify: `skills/eagle-sdd/scripts/validate.mjs`

- [x] **Step 1: Take the root from `resolveProject`**

An explicit argument still wins. Config errors are merged into the reported errors. The success
line names the config file it used, so it is never a mystery where the root came from.

- [x] **Step 2: Verify all four behaviours**

Run: `node skills/eagle-sdd/scripts/validate.mjs`
Expected: `OK` and `[eagle-sdd.yml]`

Run the same from a nested directory, and through the installed junction
Expected: the same result, with the config path shown relative to the working directory

Run it against a fixture whose `git:` is not a boolean
Expected: `F001` and exit 1

Run it with an explicit root while a config is present
Expected: the argument wins

- [x] **Step 3: Commit**

```bash
git add skills/eagle-sdd/scripts/validate.mjs
git commit -m "config: the CLI resolves its root from eagle-sdd.yml"
```

---

### Task 3: The workflow asks once

**Files:**
- Modify: `skills/eagle-sdd/SKILL.md`

- [x] **Step 1: Resolve the configuration at the top of step 1**

Read `eagle-sdd.yml` if present and use it without asking. If absent — the project's first run —
ask two structured questions and write the file, then tell the user the path so they know it exists.

- [x] **Step 2: Make commit steps conditional**

Step 5's task anatomy omits the commit step when `git: false`; step 6 commmits only when the plan
carries a commit step; step 8 confirms only what the plan asked for.

- [x] **Step 3: Replace the fixed path with `<docs>`**

Define `<docs>` once, at the end of the configuration block, and use it through the steps and the
layout diagram.

- [x] **Step 4: Verify no rule was lost and the budget holds**

Run: `node --test tests/skill.test.mjs`
Expected: all bundle tests pass, so the body is still under 500 lines and no spec-format
vocabulary reappeared

- [x] **Step 5: Commit**

```bash
git add skills/eagle-sdd/SKILL.md
git commit -m "workflow: resolve project configuration before anything else"
```

---

### Task 4: Document the config

**Files:**
- Modify: `skills/eagle-sdd/references/plan-format.md`, both templates, `README.md`, `docs/WORKFLOW.md`, `AGENTS.md`

- [x] **Step 1: Add the config to the format reference**

A section with the file, the two keys, their defaults, and what `git: false` means; the layout
diagram gains it; `F001` goes in the checks table.

- [x] **Step 2: Say where the documents are in the templates**

Both templates' filename comments name `<docs>` and say what it defaults to.

- [x] **Step 3: Document it for readers**

The README gains a Project configuration section; the walkthrough gains one and step 1 is updated;
`AGENTS.md` records the rule that this file is for project-local facts, not workflow toggles.

- [x] **Step 4: Verify the code list still matches in both directions**

Run: `node --test tests/skill.test.mjs`
Expected: the bidirectional code test passes with 14 codes

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: describe eagle-sdd.yml and the first-run questions"
```

---

### Task 5: Record and verify

**Files:**
- Add: `eagle-sdd.yml`
- Add: `docs/eagle-sdd/designs/2026-09-10-project-config-design.md`
- Add: `docs/eagle-sdd/plans/2026-09-10-project-config.md`

- [x] **Step 1: Add this repository's own configuration**

- [x] **Step 2: Verify the suite and the repository**

Run: `node --test`
Expected: 45 passing, 0 failing

Run: `node skills/eagle-sdd/scripts/validate.mjs`
Expected: `OK` with no warnings, resolving through the new config

- [x] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: record the project configuration as a plan-format pair"
```
