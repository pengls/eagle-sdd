# Harness mapping

This skill names **actions**, never tools. "Read the file", "run the check", "ask the user a question with options". That is what lets one skill body run unchanged on every harness.

This file translates those actions into the tools your environment actually exposes.

## The authoritative source is your own tool list

Tables below drift. Vendors rename tools, gate them behind config, and ship different presets. **When a table disagrees with the tools you actually have, the tools win.**

If a mapping is uncertain, ask your model to enumerate its own tools — "list the exact machine names of every tool you can call, one per line" — and use what it reports. Do not invent a tool name because a document mentioned it. A fabricated tool call fails silently or throws, and either way it stalls the workflow at the gate.

## Action vocabulary

| Action in this skill | Meaning |
|---|---|
| read a file | Retrieve file contents |
| write / edit a file | Create or modify a file on disk |
| find files by name | Glob-style path search |
| search file contents | Regex or literal content search |
| run a command | Execute a shell command and read stdout, stderr, exit code |
| **ask the user a structured question** | Present a decision with concrete options and wait for a choice |
| dispatch a subagent | Spawn an isolated agent with its own context |
| track todos | Maintain a visible task list |
| load a skill | Invoke a skill by name |
| fetch a URL | Retrieve web content |

## The one mapping that matters most

Step 2 of the workflow routes every decision through a **structured question with options**, because a prose question ends your turn and leaves the decision dangling, while a structured question carries the options and forces the decision.

That mechanic depends on your harness having a question tool. Check this first:

| Harness | Structured question |
|---|---|
| DeepSeek Harness | `ask_user_question` — options with labels, multi-select supported |
| Claude Code | `AskUserQuestion` — options with labels and descriptions |
| Codex CLI | **None.** See the fallback below. |
| Generic | Look for a tool that takes a list of options and returns a choice. |

**Fallback when no question tool exists.** Ask in prose, but batch the decisions so one turn settles as many as possible, and state explicitly that you are blocked until they answer. Then treat the end of your turn as the gate — do not continue past it on an assumption. The mechanic degrades from "forced decision" to "explicit blocking question", which is still far better than proceeding on a guess.

## Claude Code

| Action | Tool |
|---|---|
| read a file | `Read` |
| write / edit a file | `Write`, `Edit` |
| find files by name | `Glob` |
| search file contents | `Grep` |
| run a command | `Bash` |
| ask a structured question | `AskUserQuestion` |
| dispatch a subagent | `Task` — pass the agent type; a fresh subagent must not inherit this conversation |
| track todos | `TodoWrite` |
| load a skill | the `Skill` tool, or the user types `/<skill-name>` |
| fetch a URL | `WebFetch`, `WebSearch` |

## Codex CLI

Codex exposes file and shell work through the shell, and subagents behind a config flag. Verify the subagent names against your own tool list before relying on them.

| Action | Tool |
|---|---|
| read / write / edit a file | shell, or the patch tool your preset provides (`apply_patch`-style) |
| find files, search contents | shell — `rg`, `git ls-files`, `find` |
| run a command | shell |
| ask a structured question | none — use the prose fallback above |
| dispatch a subagent | `spawn_agent`. Enable multi-agent in `~/.codex/config.toml` under `[features] multi_agent = true`; without it these tools do not exist. |
| resume a dispatched agent | `followup_task` — delivers a message and triggers a turn |
| wait for a dispatched agent | `wait_agent` — an event subscription, not a poll. Wait in bounded stretches rather than short-polling. |
| list dispatched agents | `list_agents` |
| track todos | the plan/checklist tool your preset exposes |

For an isolated subagent, request a clean context explicitly — the default may copy your whole transcript into the child, which defeats the point of delegating. On recent versions that is a `fork_turns: "none"`-style argument; check your preset.

## DeepSeek Harness

| Action | Tool |
|---|---|
| read a file | `read` |
| write / edit a file | `write`, `edit` |
| find files by name | `glob` |
| search file contents | `grep` |
| run a command | `pwsh` (Windows) or `bash` |
| ask a structured question | `ask_user_question` |
| dispatch a subagent | `subagent` (fresh context), `subagent_fork` (inherits this conversation) |
| track todos | `todo_write` |
| load a skill | the `skill` tool |
| fetch a URL | `web_fetch`, `web_search` |

For reviewer isolation, `subagent` is the right call — `subagent_fork` inherits your conversation and cannot review your work impartially.

## Generic fallback

Any harness with file read, file write, and shell can run this workflow completely. Map as follows:

- read / write / edit / find / search / run → the shell (`cat`, `ls`, `rg`) or the harness's file tools
- ask a question → prose, batched, explicitly blocking
- dispatch a subagent → if unavailable, do the work inline and say that you did. **Never invent a dispatch call.** Reviewer isolation is the one guarantee you lose; compensate by re-reading the artifact against the spec rather than trusting your memory of writing it.
- track todos → a checklist inside the plan's `tasks.md`. That file is already the state.
- load a skill → read the `SKILL.md` file directly. On a harness with no skill system this is the sanctioned path, not a workaround.

## Where the skill lives on disk

The skill directory is the same everywhere. The search path differs.

| Harness | Reads |
|---|---|
| Codex CLI | `~/.agents/skills/`, `<repo>/.agents/skills/` |
| Copilot CLI | `~/.agents/skills/`, `~/.copilot/skills/`, `<repo>/.agents/skills/`, `<repo>/.github/skills/` |
| Gemini CLI | `~/.agents/skills/`, `~/.gemini/skills/`, `<repo>/.agents/skills/` |
| DeepSeek Harness | `<repo>/.dsh/skills/`, `<repo>/.agents/skills/`, `~/.dsh/skills/`, `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/`, `<repo>/.claude/skills/`, plugins |

`~/.agents/skills/` is the interoperable location: Codex, Copilot, Gemini CLI, and DeepSeek Harness all read it. Claude Code does not, so it needs a second link under `.claude/skills/`. `scripts/install.ps1` and `scripts/install.sh` in this repository set up both.

Two harness-specific notes:

- **Claude Code and DeepSeek Harness honour `disable-model-invocation: true`** in the frontmatter, which is what keeps this workflow from being invoked on the agent's own judgement.
- **Codex reads invocation policy from a sidecar**, `skills/<name>/agents/openai.yaml`, not from `SKILL.md` frontmatter. This repository ships that file.
