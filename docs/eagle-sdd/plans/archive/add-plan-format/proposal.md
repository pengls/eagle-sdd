---
change: add-plan-format
skip_specs: false
---

## Why

The skill writes one document set: a canonical spec per capability plus a delta per change.
That suits a system that needs one current description, but it is a poor fit for a repository
that wants each change to stand alone as a dated record — which is what hand-run
spec-driven-development workflows tend to produce in practice, and what the reference
implementations studied for this skill emit.

## What Changes

- The skill can produce a second document set, `plan`: a dated design document paired with a
  dated implementation plan, with no canonical tree and nothing merged.
- The format is chosen once per repository and recorded in `docs/eagle-sdd/config.yaml`, with
  `spec` as the default when nobody has chosen.
- The validator gains the `plan` format's checks, calibrated against real hand-written
  documents rather than against the templates alone.

## Capabilities

### New Capabilities

- `document-formats`

### Modified Capabilities

- `spec-driven-workflow`

## Impact

Adds `references/plan-format.md` and two templates. Extends `scripts/validate.mjs` with
thirteen codes. `SKILL.md` gains a format table, a resolution step, and per-step notes. The
`spec` format's artifacts, grammar, and checks are unchanged.
