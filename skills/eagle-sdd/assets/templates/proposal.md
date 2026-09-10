---
# Must equal the plan directory name under docs/eagle-sdd/plans/.
change: <change-id>
# true only when no observable behavior changes (pure refactor, tooling, docs).
# When true, the Capabilities section must be empty and no delta specs may exist.
skip_specs: false
---

## Why

<!-- 1-2 sentences. The problem or opportunity, from the user's side. Why now? -->

## What Changes

<!--
Bullet list of specific changes: new capabilities, modifications, removals.
Mark breaking changes with **BREAKING**.
-->

-

## Capabilities

<!--
Every path here becomes a delta file you must write at
docs/eagle-sdd/plans/<change-id>/specs/<capability-path>/spec.md.

Read docs/eagle-sdd/specs/ first, and reuse an existing capability's exact path
rather than introducing a near-duplicate. A mistyped path silently targets a
capability that does not exist.

New Capabilities: capabilities being introduced. Path segments are kebab-case,
flat unless the project already nests (`session-expiry` or `identity/user-auth`).

Modified Capabilities: capabilities whose REQUIREMENTS change. Only those whose
observable behavior changes — not implementation details. Copy the exact path
from the canonical tree.
-->

### New Capabilities

-

### Modified Capabilities

-

## Impact

<!-- Affected code, APIs, dependencies, systems, clients, migration needs. -->
