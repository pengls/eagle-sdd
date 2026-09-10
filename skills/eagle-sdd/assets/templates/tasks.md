## 1. <Task group name>

<!-- Groups are ordered by dependency: what must happen first, first. -->

- [ ] 1.1 <Task description — one independently verifiable work item>
      Covers: <requirement name>
      Depends: none
      Verify: `<command>` passes

- [ ] 1.2 <Task description>
      Covers: <requirement name>
      Depends: 1.1
      Verify: `<command>` passes

## 2. <Task group name>

- [ ] 2.1 <Task description>
      Covers: <requirement name>, <requirement name>
      Depends: 1.2
      Verify: <observable behavior you can check>

<!--
RULES THE VALIDATOR ENFORCES

Every task is a checkbox. A list item that is not `- [ ]` is not tracked.

All three tags are mandatory, as continuation lines indented four or more spaces:
  Covers:  requirement names, comma-separated — or `none` for a skip_specs
           change, which by definition alters no requirement.
           Every requirement must be covered by at least one task. This is the
           check that stops the proposal from being write-only.
  Depends: task ids, comma-separated, or `none`. Each must resolve. No cycles.
  Verify:  the command or observation that settles the task.

Verification belongs in the task, not in a separate phase. A task whose
completion you cannot observe is a heading, not a task. Reserve standalone
verification tasks for integration behavior that genuinely spans several tasks.

Each task should be small enough to finish AND verify in one sitting.

Order matters: dependencies first, so that work can be verified as it lands.
-->
