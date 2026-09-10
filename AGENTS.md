# Repository instructions

This repo ships one portable agent skill: `eagle-sdd`. Read `README.md` for
what it does and how it installs.

## Layout

- `skills/eagle-sdd/` — the skill. `SKILL.md` is the workflow spine; everything
  else is reference loaded on demand.
- `install.sh` / `install.ps1` — the installer. Downloads the skill and links it into each
  harness's skill root. Also runs in local mode, linking this checkout instead.
- `.claude-plugin/`, `.codex-plugin/` — native plugin manifests so harnesses that have a
  plugin marketplace can install without the script.
- `tests/` — Node test suites. `node --test` runs both.
- `docs/research/` — primary-source notes on OpenSpec, Superpowers, and MiMo Code's compose
  mode. These are the evidence behind the design; read them before changing a mechanic.
- `docs/eagle-sdd/` — this repository's own specs, written with the skill itself.

## Rules for editing the skill

These are not style preferences. Each one is enforced by a test in `tests/skill.test.mjs`.

- **Name actions, never tools.** Write "ask the user a structured question", not
  `AskUserQuestion`. `references/harnesses.md` owns the translation.
- **The description states when to use the skill, never what it does.** A description that
  summarises the workflow becomes a shortcut the agent follows instead of reading the body.
- **`SKILL.md` stays under 500 lines.** Push detail into `references/`; it loads on demand.
- **The frontmatter field budget is exactly the six portable Agent Skills fields plus
  `disable-model-invocation`.** Adding another requires changing that test deliberately.
- **Every validator error code is documented in `references/artifacts.md`.** Add the doc row
  in the same commit as the check.
- **Every rule exists in both document formats.** `references/artifacts.md` owns the `spec`
  format and `references/plan-format.md` owns the `plan` format. A change to the workflow
  usually has to land in both, or in the format table in `SKILL.md`.
- **Validator checks are calibrated against real documents, not the templates.** The `F` checks
  were loosened twice after being run against hand-written plans that verified things
  differently. Before tightening a rule, run it against real output and see what it rejects.
- **Read and write repository files with UTF-8 tools.** Windows PowerShell's `Get-Content -Raw`
  reads UTF-8 as ANSI and silently corrupts every non-ASCII character, which then makes the
  validator look wrong when it is not.

## Repository conventions

- `main` is the default branch. Commit messages are imperative and scoped, e.g.
  `validator: reject a MODIFIED that drops a scenario`.
- The canonical specs under `docs/eagle-sdd/specs/` are this project's source of truth for
  its own behaviour. Change them through a plan under `docs/eagle-sdd/plans/`, not by editing
  the spec directly — that is the workflow this repo exists to demonstrate.

## Before committing

```sh
node --test
node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd
```

Both must pass. A validator check that no test covers is a check nobody has seen fire.
