---
change: add-remote-install
skip_specs: false
---

## Why

Installing the skill required cloning this repository first. That is a needless step for
someone who only wants the skill, and it leaves them responsible for pulling updates by hand.

## What Changes

- A cloneless installer downloads the skill and links it into each harness's skill root.
- Re-running the installer is the update path; work already current is not rewritten.
- `--check` reports whether an update is available without changing anything.
- `--uninstall` sweeps every documented root, so it cannot leave a dangling link.
- Native plugin manifests let harnesses with a plugin marketplace install without a script.
- Run from inside a checkout, the installer links the working tree instead of downloading.

## Capabilities

### New Capabilities

- `skill-distribution`

### Modified Capabilities

## Impact

Adds `install.sh`, `install.ps1`, `.claude-plugin/`, and `.codex-plugin/`. Removes
`scripts/install.sh` and `scripts/install.ps1`, superseded by the root entry points. The
skill bundle itself and the `docs/eagle-sdd/` layout are unchanged.
