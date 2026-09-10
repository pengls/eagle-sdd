## Purpose

Deliver the skill to a machine without requiring a repository clone, keep an installed copy
current by re-running one command, and place the skill where each harness already looks.

## ADDED Requirements

### Requirement: Cloneless install
The installer SHALL install the skill on a machine that has no checkout of this repository,
using only the network and a POSIX shell or PowerShell.

#### Scenario: Piped install on a clean machine
- **WHEN** the installer is fetched and run with no checkout present
- **THEN** the skill is downloaded, stored once under the install root, and linked into the skill roots

#### Scenario: Native plugin install
- **WHEN** a harness installs this repository through its own plugin mechanism
- **THEN** the harness finds the skill through the declared skills directory without running the installer

#### Scenario: Download fails
- **WHEN** the requested ref cannot be downloaded
- **THEN** the installer exits non-zero with the ref named and modifies nothing

### Requirement: Shared download
A remote install SHALL store the skill once and link each destination to that copy, rather
than placing an independent copy in every skill root.

#### Scenario: Two harness roots
- **WHEN** a remote install targets both the agents and claude roots
- **THEN** both roots refer to the single downloaded copy and no content is duplicated

#### Scenario: Linking unavailable
- **WHEN** the platform cannot create a link at a destination
- **THEN** the installer copies instead and reports that the copy will not track later updates

### Requirement: Idempotent re-run
Re-running the installer SHALL leave an already-current destination untouched, deciding
currency by the content it exposes rather than by comparing path strings.

#### Scenario: Repeat install
- **WHEN** the installer runs again with nothing changed upstream
- **THEN** every destination reports that it is already up to date and no link or copy is rewritten

#### Scenario: Path form differs
- **WHEN** a destination and its source resolve to the same directory through different path spellings
- **THEN** the destination is still recognised as current and is not rewritten

#### Scenario: Upstream moved
- **WHEN** the requested ref resolves to a commit other than the installed one
- **THEN** the download is replaced and each destination is updated

### Requirement: Update check
The installer SHALL report whether an update is available without modifying any destination
or the installed copy.

#### Scenario: Already current
- **WHEN** the installed commit matches the requested ref and `--check` is passed
- **THEN** it reports that it is up to date and exits zero

#### Scenario: Update available
- **WHEN** the requested ref has moved past the installed commit and `--check` is passed
- **THEN** it reports that an update is available and exits with a distinct non-zero status

#### Scenario: Not installed
- **WHEN** `--check` is passed with no installed copy
- **THEN** it reports that the skill is not installed and exits non-zero

### Requirement: Complete uninstall
Uninstall SHALL remove the skill from every documented root, including roots written by an
earlier install at a different scope, and SHALL NOT leave a link pointing at a removed copy.

#### Scenario: Links exist at several scopes
- **WHEN** uninstall runs after installs at both user and project scope
- **THEN** every link is removed regardless of the scope passed to uninstall

#### Scenario: No dangling link remains
- **WHEN** uninstall removes the installed copy
- **THEN** no remaining skill root refers to it

### Requirement: Local checkout mode
Run from inside a checkout that contains the skill, the installer SHALL link the working tree
instead of downloading, so edits take effect without reinstalling.

#### Scenario: Running from a clone
- **WHEN** the installer is run from a checkout with the skill present beside it
- **THEN** each destination links to the working tree and the download is not used

#### Scenario: Explicit local path
- **WHEN** a checkout path is passed explicitly
- **THEN** that path is linked, and a path without a SKILL.md is refused
