## 1. Installer

- [x] 1.1 Write install.sh and install.ps1 with remote download, extraction and linking
      Covers: Cloneless install, Shared download
      Depends: none
      Verify: a remote install into a scratch HOME downloads the ref, stores it once under the install root, and links both default roots

- [x] 1.2 Decide currency by content fingerprint rather than by comparing path strings
      Covers: Idempotent re-run
      Depends: 1.1
      Verify: three consecutive installs report "already up to date" on runs two and three, in both link and copy mode

- [x] 1.3 Add --check, --uninstall, --ref, --scope, --harness and --copy
      Covers: Update check, Complete uninstall
      Depends: 1.1
      Verify: --check exits 0 when current, 2 when behind, 1 when not installed; --uninstall at project scope still removes user-scope links and leaves no dangling link

- [x] 1.4 Detect a checkout beside the script and link it instead of downloading
      Covers: Local checkout mode
      Depends: 1.1
      Verify: run from the repository, both default roots link to the working tree and no download occurs

- [x] 1.5 Reject unknown flags, bad scope values and bad harness values
      Covers: Cloneless install
      Depends: 1.3
      Verify: each malformed invocation exits non-zero and prints the accepted values

## 2. Native installs

- [x] 2.1 Add the Claude Code plugin and marketplace manifests and the Codex plugin manifest
      Covers: Cloneless install
      Depends: none
      Verify: all three files parse as JSON and the Codex manifest points at ./skills/

## 3. Documentation

- [x] 3.1 Document the remote install, update, check and uninstall paths in README.md
      Covers: Cloneless install, Update check
      Depends: 1.3
      Verify: every documented command matches the flags the scripts accept

- [x] 3.2 Move the installers from scripts/ to the repository root so the one-liner URL is short
      Covers: Cloneless install
      Depends: 1.1
      Verify: the raw URLs for install.sh and install.ps1 resolve, and nothing references scripts/install.*
