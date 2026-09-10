## 1. Skill

- [x] 1.1 Add `references/plan-format.md` describing the pair's layout, the required header lines, the task shape and the checks
      Covers: Two document sets, A plan-format pair is joined by date and slug
      Depends: none
      Verify: the reference names every `F` code the validator emits

- [x] 1.2 Add `assets/templates/design-doc.md` and `assets/templates/implementation-plan.md`
      Covers: Two document sets
      Depends: none
      Verify: both templates exist and the plan template carries `**Goal:**`, `**Architecture:**`, `**Tech Stack:**` and `**Spec:**`

- [x] 1.3 Add the format table, the resolution step, and the per-step format notes to `SKILL.md`
      Covers: Format resolution precedes every artifact, Format is chosen once and recorded, Default is the spec format
      Depends: 1.1, 1.2
      Verify: `SKILL.md` marks `spec` as the default, points at both reference files, and stays under 500 lines

- [x] 1.4 State in `SKILL.md` and the reference that a plan pair is frozen at its date and that archive has no merge step for it
      Covers: A plan-format pair is frozen at its date
      Depends: 1.1
      Verify: step 9 of `SKILL.md` says there is nothing to merge in the `plan` format, and `references/plan-format.md` says neither document is rewritten

## 2. Validator

- [x] 2.1 Validate design documents: dated filename, H1 title, at least three sections
      Covers: Two document sets
      Depends: none
      Verify: `node --test` cases for F101, F121 and F122 pass

- [x] 2.2 Validate plan documents: dated filename, H1, `**Goal:**`, resolved `**Spec:**`, task headings, checkbox steps
      Covers: Two document sets, A plan-format pair is joined by date and slug
      Depends: 2.1
      Verify: `node --test` cases for F101, F105, F106, F108, F109 and F110 pass

- [x] 2.3 Pair documents on the shared date and slug, and warn on a mixed or contradicted tree
      Covers: A plan-format pair is joined by date and slug, Mixed document sets are reported
      Depends: 2.2
      Verify: `node --test` cases for F111, F112, F130, F131 and F132 pass, and a plan with no `**Spec:**` line validates clean

- [x] 2.4 Calibrate the checks against real hand-written documents rather than the templates alone
      Covers: Two document sets
      Depends: 2.3
      Verify: eight real plan and eight real design documents validate with zero errors

## 3. Repository

- [x] 3.1 Record this repository's own format in `docs/eagle-sdd/config.yaml`
      Covers: Format is chosen once and recorded, Default is the spec format
      Depends: 1.3
      Verify: `node skills/eagle-sdd/scripts/validate.mjs docs/eagle-sdd` reports no error and no `F132` warning

- [x] 3.2 Document both formats, the default, and how to switch in `README.md`
      Covers: Two document sets, Default is the spec format
      Depends: 1.3
      Verify: the README describes both document sets and states which is the default
