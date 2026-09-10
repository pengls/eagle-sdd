# Spec-Driven Workflow Specification

## Purpose

Define the contract of the eagle-sdd workflow: what a change may write, what
must be covered before work is planned, and what counts as evidence that a requirement was
met. This is the behaviour the skill implements and the validator enforces.

## Requirements

### Requirement: Delta isolation
A change SHALL write only under its own plan directory, and SHALL NOT modify the canonical
specs under `specs/` at any point before archive.

#### Scenario: Specifying a change leaves the truth untouched
- **WHEN** a change declares a modified capability and writes its delta
- **THEN** the canonical spec under `specs/<capability>/spec.md` is byte-identical to what it was before

#### Scenario: Archive is the only writer
- **WHEN** the canonical specs change
- **THEN** the change that caused it has passed verification and been archived

### Requirement: Every declared capability is delivered
A proposal SHALL declare each capability it touches, and each declared capability SHALL have
a delta spec file at the matching path.

#### Scenario: Declared capability with no delta
- **WHEN** a proposal declares a new capability and no delta file exists for it
- **THEN** validation fails with D001

#### Scenario: Delta without a declaration
- **WHEN** a delta file exists for a capability the proposal does not declare
- **THEN** validation fails with D002

### Requirement: Every requirement is covered by work
Each requirement a change introduces or modifies SHALL be named by the `Covers:` tag of at
least one task.

#### Scenario: Requirement with no task
- **WHEN** a change adds a requirement and no task covers it
- **THEN** validation fails with T007

#### Scenario: Task covering nothing real
- **WHEN** a task covers a name that resolves to neither a delta nor a canonical requirement
- **THEN** validation fails with T004

### Requirement: Modification restates in full
A requirement moved under `MODIFIED Requirements` SHALL restate its complete text and every
surviving scenario, and SHALL NOT silently drop a scenario the canonical spec still carries.

#### Scenario: Scenario dropped by a modification
- **WHEN** a modified requirement omits a scenario the canonical spec still has
- **THEN** validation fails with D011

#### Scenario: Requirement renamed without a rename operation
- **WHEN** a requirement's header text changes without a corresponding entry under `RENAMED Requirements`
- **THEN** downstream references to the original name no longer resolve

### Requirement: Verification is evidence-gated
A requirement SHALL be reported as verified only when a check that establishes it has been
run and its output read in the current session.

#### Scenario: Prior run offered as evidence
- **WHEN** a check passed earlier in the session or in a previous session
- **THEN** it does not establish the requirement and the requirement stays unverified

#### Scenario: Delegated work reported as done
- **WHEN** a subagent reports that it completed a task
- **THEN** the artifact is inspected before the task is treated as done

#### Scenario: Unverified requirement
- **WHEN** a requirement has no possible check
- **THEN** it is reported to the user as a gap rather than omitted or described as complete

### Requirement: Invocation is explicit
The workflow SHALL be invoked only by an explicit request from the user, and SHALL NOT be
entered on the agent's own judgement.

#### Scenario: Agent judges the request to be complex
- **WHEN** a request is ambiguous or spans multiple sessions but the user has not asked for this workflow
- **THEN** the workflow is not entered

#### Scenario: Harness without an invocation-policy field
- **WHEN** the harness reads neither `disable-model-invocation` nor a policy sidecar
- **THEN** the description marks the workflow as explicitly invoked only

### Requirement: Archive merges in a fixed order
Archiving SHALL apply `RENAMED`, then `REMOVED`, then `MODIFIED`, then `ADDED`, matching
requirements by normalized name, so that the merge is idempotent.

#### Scenario: Archive re-run after a partial failure
- **WHEN** the merge is applied a second time to the same change
- **THEN** the canonical specs are unchanged from the first application

#### Scenario: Renamed requirement replaced by a same-named addition
- **WHEN** a change renames a requirement and another change adds a requirement with the old name
- **THEN** the rename is applied first and the two do not collide

### Requirement: Mechanical work is routed out
The workflow SHALL be declined for changes that alter no observable behaviour, and SHALL
record such a change with `skip_specs: true` when it is tracked anyway.

#### Scenario: Pure refactor
- **WHEN** a change alters no observable behaviour
- **THEN** the proposal sets `skip_specs: true` and declares no capabilities

#### Scenario: Declaring capabilities under skip_specs
- **WHEN** `skip_specs: true` is set and capabilities are declared
- **THEN** validation fails with P005

#### Scenario: Behaviour change without a spec change
- **WHEN** a change alters observable behaviour and declares no capability
- **THEN** validation fails with P004

### Requirement: Format resolution precedes every artifact
The workflow SHALL resolve which document set is in use before it writes any artifact, and
SHALL NOT infer the format from the size or apparent simplicity of the request.

#### Scenario: Step order
- **WHEN** the workflow starts
- **THEN** the format is resolved during the orient step, before the grill and before any document is written

#### Scenario: Small change in a plan-format repository
- **WHEN** a change is a one-line edit but the repository uses the `plan` format
- **THEN** the change is recorded in the `plan` format
