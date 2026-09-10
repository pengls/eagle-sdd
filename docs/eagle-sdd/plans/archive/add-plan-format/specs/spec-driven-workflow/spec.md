## ADDED Requirements

### Requirement: Format resolution precedes every artifact
The workflow SHALL resolve which document set is in use before it writes any artifact, and
SHALL NOT infer the format from the size or apparent simplicity of the request.

#### Scenario: Step order
- **WHEN** the workflow starts
- **THEN** the format is resolved during the orient step, before the grill and before any document is written

#### Scenario: Small change in a plan-format repository
- **WHEN** a change is a one-line edit but the repository uses the `plan` format
- **THEN** the change is recorded in the `plan` format
