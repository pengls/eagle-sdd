# Document Formats Specification

## Purpose

Let a repository choose between two ways of recording a change: an accumulating canonical
spec with per-change deltas, or a pair of dated documents that stand alone.

## Requirements

### Requirement: Two document sets
The skill SHALL be able to produce either a canonical-spec document set or a dated-pair
document set, and SHALL produce exactly one of them for a given change.

#### Scenario: Spec format change
- **WHEN** the repository's format is `spec`
- **THEN** the change writes a proposal, deltas, and tasks under `plans/<change-id>/`, and only Archive writes under `specs/`

#### Scenario: Plan format change
- **WHEN** the repository's format is `plan`
- **THEN** the change writes `designs/<date>-<slug>-design.md` and `plans/<date>-<slug>.md`, and writes nothing under `specs/`

#### Scenario: No artifact from the other format
- **WHEN** a change is written in one format
- **THEN** it creates no artifact belonging to the other

### Requirement: Format is chosen once and recorded
The skill SHALL resolve the document format from `docs/eagle-sdd/config.yaml`, asking the user
only when the file does not record one, and SHALL honour a per-run override by rewriting it.

#### Scenario: Recorded format
- **WHEN** `config.yaml` names a format
- **THEN** the skill uses it and does not ask the user to choose again

#### Scenario: Unrecorded format
- **WHEN** `config.yaml` is absent
- **THEN** the skill asks, presenting `spec` as the recommendation, and records the answer

#### Scenario: Override
- **WHEN** the user asks for the other format during a run
- **THEN** the skill uses it and rewrites `config.yaml` so the next run does not have to ask

### Requirement: Default is the spec format
Absent any recorded choice or instruction, the skill SHALL use the `spec` format.

#### Scenario: Nothing recorded and nothing asked
- **WHEN** the skill must proceed without a recorded format or a user decision
- **THEN** it uses `spec`

### Requirement: A plan-format pair is joined by date and slug
A design document and its plan document SHALL share one `<YYYY-MM-DD>-<slug>` identity, and the
validator SHALL pair them on it rather than on any link inside the documents.

#### Scenario: Plan omits the Spec link
- **WHEN** a plan document carries no `**Spec:**` line
- **THEN** it is still paired with the design document of the same slug and no error is raised

#### Scenario: Spec link does not resolve
- **WHEN** a plan document carries a `**Spec:**` line pointing at a file that does not exist
- **THEN** validation fails

### Requirement: A plan-format pair is frozen at its date
Neither document of a `plan` pair SHALL be rewritten after it is written, and there SHALL be no
merge step.

#### Scenario: A decision changes later
- **WHEN** a decision recorded in a design document changes
- **THEN** the change is recorded as a new dated pair rather than as an edit

#### Scenario: Verification passes
- **WHEN** a `plan` change is verified
- **THEN** archiving confirms the pair and leaves both files in place

### Requirement: Mixed document sets are reported
The validator SHALL warn when a repository contains both document sets, or when `config.yaml`
names a format the documents do not match.

#### Scenario: Records for both formats
- **WHEN** a repository holds both a canonical spec tree and dated pairs
- **THEN** validation warns without failing

#### Scenario: Config contradicts the documents
- **WHEN** `config.yaml` names a format that present documents contradict
- **THEN** validation warns without failing
