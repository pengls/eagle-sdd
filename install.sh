#!/bin/sh
# Install or update the eagle-sdd skill. No repository clone required.
#
#   curl -fsSL https://raw.githubusercontent.com/pengls/eagle-sdd/main/install.sh | sh
#
# Options (or the EAGLE_SDD_* environment variables):
#
#   --ref <git-ref>     branch, tag, or commit           (default: main)
#   --scope <s>         project | user | both            (default: user remotely, both locally)
#   --harness <list>    agents,claude,dsh,copilot,gemini (default: agents,claude)
#   --install-root <d>  where the download is kept       (default: ~/.eagle-sdd)
#   --local <path>      link a checkout instead of downloading
#   --copy              copy instead of symlink
#   --check             report whether an update is available; change nothing
#   --uninstall         remove the links and the download
#
# Re-running is how you update. Work that is already current is left alone.

set -eu

SKILL_NAME='eagle-sdd'
REPO_SLUG='pengls/eagle-sdd'

# ---------------------------------------------------------------- arguments

REF="${EAGLE_SDD_REF:-main}"
SCOPE="${EAGLE_SDD_SCOPE:-}"
HARNESS="${EAGLE_SDD_HARNESS:-agents,claude}"
INSTALL_ROOT="${EAGLE_SDD_HOME:-$HOME/.eagle-sdd}"
LOCAL_PATH=""
COPY=0
CHECK=0
UNINSTALL=0

die() { printf '%s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,19p' "$0" | sed 's/^#\{1,\} \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)          [ $# -ge 2 ] || die "--ref needs a value";          REF="$2"; shift 2 ;;
    --scope)        [ $# -ge 2 ] || die "--scope needs a value";        SCOPE="$2"; shift 2 ;;
    --harness)      [ $# -ge 2 ] || die "--harness needs a value";      HARNESS="$2"; shift 2 ;;
    --install-root) [ $# -ge 2 ] || die "--install-root needs a value"; INSTALL_ROOT="$2"; shift 2 ;;
    --local)        [ $# -ge 2 ] || die "--local needs a value";        LOCAL_PATH="$2"; shift 2 ;;
    --copy)         COPY=1; shift ;;
    --check)        CHECK=1; shift ;;
    --uninstall)    UNINSTALL=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *)              die "Unknown option: $1 (try --help)" ;;
  esac
done

# ------------------------------------------------------------ mode + targets

# Local mode: the script came from a checkout that still has the skill beside it.
# A piped install has no such neighbour, so it downloads instead.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LOCAL_SKILL=""
if [ -n "$LOCAL_PATH" ]; then
  if [ -f "$LOCAL_PATH/SKILL.md" ]; then
    LOCAL_SKILL="$LOCAL_PATH"
  elif [ -f "$LOCAL_PATH/skills/$SKILL_NAME/SKILL.md" ]; then
    LOCAL_SKILL="$LOCAL_PATH/skills/$SKILL_NAME"
  else
    die "No SKILL.md under --local $LOCAL_PATH"
  fi
elif [ -f "$SCRIPT_DIR/skills/$SKILL_NAME/SKILL.md" ]; then
  LOCAL_SKILL="$SCRIPT_DIR/skills/$SKILL_NAME"
fi
IS_LOCAL=0
if [ -n "$LOCAL_SKILL" ]; then IS_LOCAL=1; fi

if [ -z "$SCOPE" ]; then
  if [ "$IS_LOCAL" -eq 1 ]; then SCOPE='both'; else SCOPE='user'; fi
fi
case "$SCOPE" in
  project|user|both) ;;
  *) die "--scope must be project, user, or both (got '$SCOPE')" ;;
esac

HARNESS=$(printf '%s' "$HARNESS" | tr 'A-Z' 'a-z' | tr -d ' ')
for h in $(printf '%s' "$HARNESS" | tr ',' ' '); do
  case "$h" in
    agents|claude|dsh|copilot|gemini) ;;
    *) die "--harness has unknown value '$h'. Known: agents, claude, dsh, copilot, gemini" ;;
  esac
done

has_harness() {
  case ",$HARNESS," in *",$1,"*) return 0 ;; esac
  return 1
}

project_root() {
  dir=$(pwd)
  while [ -n "$dir" ]; do
    if [ -d "$dir/.git" ]; then printf '%s' "$dir"; return 0; fi
    parent=$(dirname "$dir")
    if [ "$parent" = "$dir" ]; then break; fi
    dir="$parent"
  done
  pwd
}

# One "<label>\t<root>" line per destination.
list_targets() {
  proj=$(project_root)
  case "$SCOPE" in
    project|both)
      if has_harness agents; then printf '%s\t%s\n' '.agents/skills            project' "$proj/.agents/skills"; fi
      if has_harness claude; then printf '%s\t%s\n' '.claude/skills            project' "$proj/.claude/skills"; fi
      ;;
  esac
  case "$SCOPE" in
    user|both)
      if has_harness agents;  then printf '%s\t%s\n' '~/.agents/skills           user' "$HOME/.agents/skills"; fi
      if has_harness claude;  then printf '%s\t%s\n' '~/.claude/skills           user' "$HOME/.claude/skills"; fi
      if has_harness dsh;     then printf '%s\t%s\n' '~/.dsh/skills              user' "$HOME/.dsh/skills"; fi
      if has_harness copilot; then printf '%s\t%s\n' '~/.copilot/skills          user' "$HOME/.copilot/skills"; fi
      if has_harness gemini;  then printf '%s\t%s\n' '~/.gemini/skills           user' "$HOME/.gemini/skills"; fi
      ;;
  esac
  return 0
}

# Uninstall sweeps EVERY documented root, not the requested scope. A link left
# behind by an earlier install at another scope would be left dangling the
# moment the shared download is removed.
list_all_targets() {
  proj=$(project_root)
  printf '%s\t%s\n' '.agents/skills            project' "$proj/.agents/skills"
  printf '%s\t%s\n' '.claude/skills            project' "$proj/.claude/skills"
  printf '%s\t%s\n' '~/.agents/skills           user' "$HOME/.agents/skills"
  printf '%s\t%s\n' '~/.claude/skills           user' "$HOME/.claude/skills"
  printf '%s\t%s\n' '~/.dsh/skills              user' "$HOME/.dsh/skills"
  printf '%s\t%s\n' '~/.copilot/skills          user' "$HOME/.copilot/skills"
  printf '%s\t%s\n' '~/.gemini/skills           user' "$HOME/.gemini/skills"
  return 0
}

# ----------------------------------------------------------------- hashing

if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD='sha256sum'
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD='shasum -a 256'
else
  HASH_CMD=''
fi

hash_file() {
  if [ -n "$HASH_CMD" ]; then $HASH_CMD < "$1" | awk '{print $1}'
  else cksum < "$1" | awk '{print $1"-"$2}'; fi
}

hash_stream() {
  if [ -n "$HASH_CMD" ]; then $HASH_CMD | awk '{print $1}'
  else cksum | awk '{print $1"-"$2}'; fi
}

# Content fingerprint: sorted relative paths plus each file's hash.
#
# Installed state is decided by CONTENT rather than by comparing path strings.
# A symlink to the right directory and a stale copy are then distinguishable
# without ever resolving a path, and link and copy installs behave identically.
tree_hash() {
  if [ ! -d "$1" ]; then printf 'missing'; return 0; fi
  (
    cd "$1" || exit 1
    find . -type f -print | LC_ALL=C sort | while IFS= read -r f; do
      printf '%s:%s\n' "${f#./}" "$(hash_file "$f")"
    done
  ) | hash_stream
}

# ---------------------------------------------------------------- download

fetch() {
  # $1 = url, $2 = output file
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 120 -o "$2" "$1" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 120 -O "$2" "$1" 2>/dev/null
  else
    die "Neither curl nor wget is available; cannot download. Use --local instead."
  fi
}

fetch_text() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 20 "$1" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 20 -O - "$1" 2>/dev/null
  else
    return 1
  fi
}

remote_sha() {
  fetch_text "https://api.github.com/repos/$REPO_SLUG/commits/$1" \
    | sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' \
    | head -n 1
}

read_state() {
  if [ ! -f "$INSTALL_ROOT/state" ]; then return 0; fi
  sed -n "s/^$1=//p" "$INSTALL_ROOT/state" | head -n 1
}

write_state() {
  # $1 ref, $2 sha, $3 mode, $4 source
  mkdir -p "$INSTALL_ROOT"
  {
    printf 'ref=%s\n' "$1"
    printf 'sha=%s\n' "$2"
    printf 'mode=%s\n' "$3"
    printf 'scope=%s\n' "$SCOPE"
    printf 'harnesses=%s\n' "$HARNESS"
    printf 'installed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'source=%s\n' "$4"
  } > "$INSTALL_ROOT/state"
}

# Sets DOWNLOADED. Deliberately not called in a command substitution: its
# progress output would be captured along with the path.
DOWNLOADED=''
download_skill() {
  staging=$(mktemp -d "${TMPDIR:-/tmp}/eagle-sdd.XXXXXX")
  trap 'rm -rf "$staging"' EXIT INT TERM

  printf 'Downloading %s@%s\n' "$REPO_SLUG" "$REF"
  ok=0
  for url in \
    "https://codeload.github.com/$REPO_SLUG/tar.gz/refs/heads/$REF" \
    "https://codeload.github.com/$REPO_SLUG/tar.gz/refs/tags/$REF" \
    "https://codeload.github.com/$REPO_SLUG/tar.gz/$REF"
  do
    if fetch "$url" "$staging/source.tar.gz" && [ -s "$staging/source.tar.gz" ]; then
      ok=1
      break
    fi
  done
  if [ "$ok" -ne 1 ]; then die "Could not download ref '$REF' from $REPO_SLUG"; fi

  mkdir -p "$staging/x"
  tar -xzf "$staging/source.tar.gz" -C "$staging/x" || die "tar failed to extract the download"

  found=$(find "$staging/x" -type f -name SKILL.md -path "*/$SKILL_NAME/*" | head -n 1)
  if [ -z "$found" ]; then die "The download does not contain skills/$SKILL_NAME/SKILL.md"; fi

  src=$(dirname "$found")
  if ! head -n 6 "$src/SKILL.md" | grep -q "^name:[[:space:]]*$SKILL_NAME[[:space:]]*$"; then
    die "Refusing to install: SKILL.md does not declare name: $SKILL_NAME"
  fi

  mkdir -p "$INSTALL_ROOT"
  rm -rf "$INSTALL_ROOT/skill"
  mv "$src" "$INSTALL_ROOT/skill"
  DOWNLOADED="$INSTALL_ROOT/skill"

  rm -rf "$staging"
  trap - EXIT INT TERM
}

# Always returns 0: a "nothing to do" result must not trip `set -e` and abort
# the loop that is walking the targets.
install_one() {
  # $1 source, $2 root, $3 label, $4 source hash
  target="$2/$SKILL_NAME"
  mkdir -p "$2"

  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$(tree_hash "$target")" = "$4" ]; then
      printf '  %s already up to date\n' "$3"
      return 0
    fi
    rm -rf "$target"
  fi

  if [ "$COPY" -eq 1 ]; then
    cp -R "$1" "$target"
    printf '  %s copied\n' "$3"
  elif ln -s "$1" "$target" 2>/dev/null; then
    printf '  %s linked\n' "$3"
  else
    cp -R "$1" "$target"
    printf '  %s symlink unavailable, copied instead\n' "$3"
  fi
  return 0
}

# ------------------------------------------------------------------- actions

if [ "$UNINSTALL" -eq 1 ]; then
  printf 'Uninstalling %s\n' "$SKILL_NAME"
  list_all_targets | while IFS='	' read -r label root; do
    target="$root/$SKILL_NAME"
    if [ -e "$target" ] || [ -L "$target" ]; then
      rm -rf "$target"
      printf '  %s removed\n' "$label"
    fi
  done
  rm -rf "$INSTALL_ROOT/skill" "$INSTALL_ROOT/state"
  rmdir "$INSTALL_ROOT" 2>/dev/null || true
  printf '\nRemoved the links and %s\n' "$INSTALL_ROOT"
  exit 0
fi

if [ "$CHECK" -eq 1 ]; then
  if [ ! -d "$INSTALL_ROOT/skill" ]; then
    printf 'Not installed (no skill under %s).\n' "$INSTALL_ROOT"
    exit 1
  fi
  installed_ref=$(read_state ref)
  if [ -z "$installed_ref" ]; then installed_ref='(unknown)'; fi
  installed_sha=$(read_state sha)
  if [ -z "$installed_sha" ]; then installed_sha='(none recorded)'; fi
  printf 'Installed ref:  %s\n' "$installed_ref"
  printf 'Installed sha:  %s\n' "$installed_sha"

  if [ "$(read_state mode)" = 'local' ]; then
    printf 'Mode:           local checkout - updates track your working tree\n'
    exit 0
  fi

  latest=$(remote_sha "$installed_ref" || true)
  if [ -z "$latest" ]; then
    printf 'Latest sha:     unavailable (GitHub API unreachable or rate limited)\n'
    exit 0
  fi
  printf 'Latest sha:     %s\n' "$latest"
  if [ "$installed_sha" = "$latest" ]; then
    printf '\nUp to date.\n'
    exit 0
  fi
  printf '\nAn update is available. Re-run the installer to apply it.\n'
  exit 2
fi

printf '\n'
if [ "$IS_LOCAL" -eq 1 ]; then
  printf 'Installing %s from the local checkout\n' "$SKILL_NAME"
  printf '  source: %s\n' "$LOCAL_SKILL"
  SOURCE="$LOCAL_SKILL"
  MODE='local'
  SHA=''
  STATE_REF='local'
else
  SHA=$(remote_sha "$REF" || true)
  cached="$INSTALL_ROOT/skill"
  if [ -n "$SHA" ] && [ "$(read_state sha)" = "$SHA" ] && [ -f "$cached/SKILL.md" ]; then
    printf '%s is already current at %s; verifying links\n' "$REF" "$(printf '%s' "$SHA" | cut -c1-8)"
    SOURCE="$cached"
  else
    download_skill
    SOURCE="$DOWNLOADED"
  fi
  MODE='remote'
  STATE_REF="$REF"
  printf '  source: %s\n' "$SOURCE"
fi
printf '\n'

SOURCE_HASH=$(tree_hash "$SOURCE")
list_targets | while IFS='	' read -r label root; do
  install_one "$SOURCE" "$root" "$label" "$SOURCE_HASH"
done

write_state "$STATE_REF" "$SHA" "$MODE" "$SOURCE"

printf '\n'
printf 'Invoke it by name in a fresh session:\n'
printf '  Claude Code / DeepSeek Harness   /%s\n' "$SKILL_NAME"
printf '  Codex                            appears in the skill list; never auto-triggers\n'
printf '\n'
printf '  check for updates   sh install.sh --check\n'
printf '  remove              sh install.sh --uninstall\n'
