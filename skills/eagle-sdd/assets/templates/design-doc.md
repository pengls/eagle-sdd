# <Title> Design

<!--
The first of the two documents a change produces. The second is its implementation plan, whose
**Spec:** line points back here.

This document is frozen at its date: nothing rewrites it. A decision that changes later becomes a
new dated pair, so the record of what was believed on a given day survives.

Filename: docs/eagle-sdd/designs/<YYYY-MM-DD>-<slug>-design.md

Write the document in the language the user is working in. The English headings below ARE the
format; translate them only if the project's other documents do.
-->

Date: <YYYY-MM-DD>
Module: <area, route, or package this touches>
Project: <repository or service name>

## 1. Requirement summary

<!-- What is being asked for, from the user's side. Two or three sentences. Say
     what this change is NOT covering if that is likely to be assumed. -->

## 2. Confirmed decisions

<!-- The decisions the grill step settled, as a table. This is the section that
     makes the document worth keeping: it records the choice AND the alternative
     that lost, so a later reader does not relitigate it. -->

| Question | Decision |
|---|---|
| <the choice that had to be made> | <what was chosen, and the option it beat> |

## 3. Current state and problem

<!-- What exists today, with file paths and line references, and specifically
     what is wrong with it. Concrete, not "the code is messy". -->

## 4. Detailed design

<!-- The change itself. Reference real paths and real symbols. Code that encodes
     a decision more precisely than prose can goes here, trimmed to the
     decision-rich part. -->

### 4.1 <area>

## 5. Out of scope

<!-- What this change deliberately does not touch, and what it must not break. -->

## 6. How to verify

<!-- How a human confirms this works. Commands, URLs, accounts, expected
     observations. The plan document's per-task Run:/Expected: steps handle the
     mechanical checks; this section covers "is the feature actually right". -->
