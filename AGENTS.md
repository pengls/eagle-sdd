# Repository instructions

This repo ships one portable agent skill: `eagle-sdd`. Read `README.md` for what it does and how
it installs, and `docs/WORKFLOW.md` for the flow written for a human reader.

## Layout

- `skills/eagle-sdd/` — the skill. `SKILL.md` is the seven-step spine; everything else is
  reference loaded on demand.
- `install.sh` / `install.ps1` — the installer. Downloads the skill and links it into each
  harness's skill root. Also runs in local mode, linking this checkout instead.
- `.claude-plugin/`, `.codex-plugin/` — native plugin manifests so harnesses that have a plugin
  marketplace can install without the script.
- `tests/` — Node test suites. `node --test` runs both.
- `docs/research/` — primary-source notes on Superpowers, MiMo Code's compose mode, and OpenSpec.
  These are the evidence behind the design; read them before changing a mechanic.
- `docs/eagle-sdd/` — this repository's own design-and-plan pairs, written with the skill itself.

## There is exactly one document format

Version 2 removed the `spec` set (canonical specs, deltas, proposals, archive). The skill produces
one dated pair per change and nothing else:

```
docs/eagle-sdd/designs/<YYYY-MM-DD>-<slug>-design.md
docs/eagle-sdd/plans/<YYYY-MM-DD>-<slug>.md
```

Do not reintroduce a format choice, a config file, or a canonical tree. If a rule only makes sense
for an accumulating spec, it belongs to a format this skill does not have.

## Rules for editing the skill

These are not style preferences. Each one is enforced by a test in `tests/skill.test.mjs`.

- **Name actions, never tools.** Write "ask the user a structured question", not
  `AskUserQuestion`. `references/harnesses.md` owns the translation.
- **The description states when to use the skill, never what it does.** A description that
  summarises the workflow becomes a shortcut the agent follows instead of reading the body.
- **`SKILL.md` stays under 500 lines.** Push detail into `references/`; it loads on demand.
- **The frontmatter field budget is exactly the six portable Agent Skills fields plus
  `disable-model-invocation`.** Adding another requires changing that test deliberately.
- **Every validator code is documented in `references/plan-format.md`.** Add the doc row in the
  same commit as the check.
- **A check that fails correct work gets disabled, and a disabled check protects nothing.** The
  `F` codes were loosened twice after being run against real hand-written documents. Before
  tightening a rule, run it against real output and see what it rejects.
- **Read and write repository files with UTF-8 tools.** Windows PowerShell's `Get-Content -Raw`
  reads UTF-8 as ANSI and silently corrupts every non-ASCII character, which then makes the
  validator look wrong when it is not.

## Repository conventions

- `main` is the default branch. Commit messages are imperative and scoped, e.g.
  `validator: report a plan whose Spec link does not resolve`.
- This project's own decisions live in `docs/eagle-sdd/`. Change them through the workflow, not
  by editing a frozen document — that is the practice this repo exists to demonstrate.

## Before committing

```sh
node --test
node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd
```

Both must pass. A validator code that no test covers is a code nobody has seen fire.
