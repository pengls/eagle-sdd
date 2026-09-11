# Project configuration Design

Date: 2026-09-10
Module: the skill bundle (`skills/eagle-sdd/`) and the workflow spine
Project: eagle-sdd

## 1. Requirement summary

The documents directory was hardcoded to `docs/eagle-sdd`, and the workflow committed as it went
without ever asking whether it should. Both are project-level decisions that the skill was making
on the project's behalf.

This adds `eagle-sdd.yml` at the project root, holding exactly two settings — where the documents
live, and whether the workflow may touch git. On a project's first run the workflow asks both as
structured questions and writes the file; every later run reads it and stays quiet. To change
either, the user edits the file.

## 2. Confirmed decisions

| Question | Decision |
|---|---|
| Where the config lives | The **project root**, never inside `<docs>` — it is what says where `<docs>` is, and a file cannot declare its own location |
| How many settings | Two, as asked: `docs` and `git`. Not a general settings surface |
| Ask once or every run | Once. Written on the first run, read silently afterwards |
| Who writes it | Only the first run. Nothing else ever writes to it, so a hand edit is never overwritten |
| `git` shape | A boolean. True means `git init` when needed plus a commit per task; false means no git command at all and no commit step in the plan |
| What happens when `docs` moves | Existing plans keep their old `**Spec:**` path and still validate — the pair is joined on the slug, and the link is a courtesy |
| Validator behaviour | Reads the config itself, searching upward from the working directory; an explicit argument still overrides |
| Does this undo the v2 config removal | No. v2 removed a config that chose between two *formats*. This one holds two facts only the project knows. The distinction is now written into `AGENTS.md` as a rule |

Considered and rejected: a third `format` key (there is only one format; the workflow's design is
not up for a vote it already had); putting the config inside `<docs>` (self-referential, and the
file would move with the directory it describes, so moving would break it); asking every run
(annoying, and the answer does not change); inferring `git` from whether the project is a repo
(wrong for a repo the user does not want the agent committing to); making the workflow ask before
each commit (the point of the setting is that it is decided once).

## 3. Current state and problem

`docs/eagle-sdd` appeared as a literal in nineteen places across `SKILL.md`, the format reference,
both templates, the README and the walkthrough. A project that wanted its documents elsewhere had
to edit the skill, which the installer overwrites on the next update.

Git was harder to notice: the plan template carried a commit step in every task, and step 6 of the
spine said to commit, with no way to say no. A project that is not a repository, or that keeps the
agent out of its history, had to notice and delete those steps by hand — and would lose that edit
on the next generated plan.

The validator was the sharpest edge. Its root defaulted to `docs/eagle-sdd`, so a project with a
different directory had to pass the path on every invocation, and `npm run validate` was wrong
until someone remembered to change it.

## 4. Detailed design

### 4.1 The file

```yaml
# eagle-sdd project configuration. Edit this file directly; nothing rewrites it.
#
# docs  where the design-and-plan pairs live, relative to this file.
# git   true  - initialise a repository if the project has none, and commit
#               after each finished task.
#       false - leave version control entirely alone.

docs: docs/eagle-sdd
git: true
```

Two scalar keys, with the comments doing the documentation so the file explains itself to whoever
opens it next.

### 4.2 Resolution

`resolveProject({ cwd, explicit })` searches upward from the working directory for `eagle-sdd.yml`,
and returns the documents root, the project root, the git setting, the config path, and any config
errors. Documented defaults apply when there is no file. An explicit argument wins over the
config, so the config can never make the validator impossible to point somewhere else.

### 4.3 Parsing without a dependency

The validator is zero-dependency by test, so the config reader is a small `key: value` scanner
handling whole-line and trailing `#` comments and quoted values. It is deliberately incapable of
more than the file contains. The boolean grammar is the one DSH itself accepts — `true/false`,
`yes/no`, `on/off`, `1/0` — so the two never disagree about the same file.

### 4.4 A moved directory does not break history

`resolveSpecRef` gains a last-resort base: the design of that name sitting in `<root>/designs`.
Moving the documents directory is now a one-line change, and every plan written before the move
carries the old path in its `**Spec:**`. Those pairs are still correct — the slug is the identity
and the link is a courtesy — so a move must not turn historical documents into errors. The test
that covers this writes a plan pointing at the old path and asserts no errors.

### 4.5 Config errors are reported, not swallowed

A config the validator silently ignores is a config that gets edited forever with no effect, so
`F001` reports an empty `docs` and a `git` that is not a boolean. The CLI merges config errors into
the same output as document errors.

### 4.6 The two questions

Asked in step 1, as structured questions, before anything is read: where the documents should
live, and whether the workflow may touch git. Both carry a recommendation. The path is written
relative to the config file, so the project can be moved or the directory renamed later.

## 5. Out of scope

The document grammar is unchanged; the validator gains `F001` and nothing else. The installer, the
plugin manifests, the eight steps and the three gates are untouched. The `docs: false` idea — no
documents at all — is not a feature; a project that wants no documents wants a different workflow.

## 6. How to verify

1. `node --test` — 45 cases, including eleven on the config layer.
2. `node skills/eagle-sdd/scripts/validate.mjs` with no argument in this repository — resolves
   through the committed `eagle-sdd.yml` and reports which file it used.
3. The same, from a nested directory, and through the installed junction — the upward search must
   work in both.
4. A fixture with `docs: spec/eagle` and plans carrying the old `docs/eagle-sdd` path — no errors.
5. A malformed config — `F001`, and a non-zero exit.
6. An explicit argument against a config — the argument wins.
