## Purpose

<!--
NEW CAPABILITIES ONLY. One or two sentences (50+ characters) on what this
capability is for. Archive copies it into the new canonical spec.
DELETE this section for a delta against an existing capability — that spec
already has a Purpose and a delta's would be ignored.
-->

## ADDED Requirements

### Requirement: <requirement name>

<!--
The system SHALL <observable behavior>.
Use SHALL or MUST. Never should, may, can, or prefer.

Describe what a user or downstream system can rely on: inputs, outputs, error
conditions, external constraints. Not internal class names, not library choices,
not step-by-step detail — those belong in design.md or tasks.md.

Quick test: if the implementation can change without changing externally visible
behavior, it does not belong here.
-->

#### Scenario: <scenario name>

- **WHEN** <condition>
- **THEN** <expected outcome>

<!--
Exactly four hashes. Three produces a header the validator does not recognize,
and the requirement then fails as having no scenarios.

At least one scenario per requirement. A scenario is a test you have not written
yet: if you cannot phrase it as an observable WHEN/THEN, the requirement is not
specified yet.
-->

## MODIFIED Requirements

<!--
Restate the requirement IN FULL: the new text plus every surviving scenario,
copied from docs/eagle-sdd/specs/<capability>/spec.md.

A partial restatement silently deletes whatever you left out. The validator will
reject a modification that drops a scenario the canonical spec still has.

Adding a scenario without changing existing behavior is ADDED, not MODIFIED.
-->

### Requirement: <requirement name>

<full restated text>

#### Scenario: <scenario name>

- **WHEN** <condition>
- **THEN** <expected outcome>

## REMOVED Requirements

### Requirement: <requirement name>

**Reason**: <why it is going away>
**Migration**: <what callers must do instead>

## RENAMED Requirements

<!--
Name changes only. Renaming a requirement is its own operation — never a quiet
edit of the header, because tasks, tests, and review all join on that name.
Delete this section when there are no renames.
-->

- `<old name>` → `<new name>`
