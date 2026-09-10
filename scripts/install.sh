#!/bin/sh
# Install the eagle-sdd skill into the places agent harnesses read.
#
#   sh scripts/install.sh            # project and user roots
#   sh scripts/install.sh project    # only this repository
#   sh scripts/install.sh user       # only your home directory
#   sh scripts/install.sh user copy  # copy instead of symlink
#
# Symlinks are the default so that editing the repository changes the installed
# skill. A copy will not track later edits.

set -eu

scope="${1:-both}"
mode="${2:-link}"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
skill_name="eagle-sdd"
source_dir="$repo_root/skills/$skill_name"

if [ ! -d "$source_dir" ]; then
  echo "Skill source not found: $source_dir" >&2
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
linked=0
copied=0
skipped=0

install_one() {
  root="$1"
  label="$2"
  target="$root/$skill_name"

  mkdir -p "$root"

  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$(readlink "$target" 2>/dev/null || true)" = "$source_dir" ]; then
      printf '  = %s  (already linked)\n' "$label"
      skipped=$((skipped + 1))
      return
    fi
    mv "$target" "$target.pre-eagle-sdd-$stamp"
    printf '  ! %s  (existing entry moved aside)\n' "$label"
  fi

  if [ "$mode" != "copy" ] && ln -s "$source_dir" "$target" 2>/dev/null; then
    printf '  + %s\n' "$label"
    linked=$((linked + 1))
    return
  fi

  cp -R "$source_dir" "$target"
  printf '  + %s  (copy)\n' "$label"
  copied=$((copied + 1))
}

echo ""
echo "Installing '$skill_name' from $source_dir"
echo ""

case "$scope" in
  project)
    install_one "$repo_root/.agents/skills" '.agents/skills            project'
    install_one "$repo_root/.claude/skills" '.claude/skills            project'
    ;;
  user)
    install_one "$HOME/.agents/skills" '~/.agents/skills           user'
    install_one "$HOME/.claude/skills" '~/.claude/skills           user'
    install_one "$HOME/.dsh/skills" '~/.dsh/skills              user'
    install_one "$HOME/.copilot/skills" '~/.copilot/skills          user'
    ;;
  both)
    install_one "$repo_root/.agents/skills" '.agents/skills            project'
    install_one "$repo_root/.claude/skills" '.claude/skills            project'
    install_one "$HOME/.agents/skills" '~/.agents/skills           user'
    install_one "$HOME/.claude/skills" '~/.claude/skills           user'
    install_one "$HOME/.dsh/skills" '~/.dsh/skills              user'
    install_one "$HOME/.copilot/skills" '~/.copilot/skills          user'
    ;;
  *)
    echo "Unknown scope: $scope (expected project, user, or both)" >&2
    exit 1
    ;;
esac

echo ""
echo "linked $linked, copied $copied, already present $skipped"

if [ "$copied" -gt 0 ]; then
  echo ""
  echo "Copies do not track later edits. Re-run this script after changing the skill."
fi

echo ""
echo "Verify in a fresh agent session:"
echo "  Claude Code          /eagle-sdd"
echo "  DeepSeek Harness     /eagle-sdd"
echo "  Codex                the skill appears in the skill listing; it will not auto-trigger"
