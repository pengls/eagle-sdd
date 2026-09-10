<#
.SYNOPSIS
  Install the eagle-sdd skill into the places agent harnesses read.

.DESCRIPTION
  Links (or copies) skills/eagle-sdd into every skill root this
  repository knows about. Run from anywhere; the repository root is derived from
  this script's location.

  Windows uses directory junctions, which need neither administrator rights nor
  Developer Mode. If a junction cannot be created, the skill is copied instead
  and the script says so — a copy will not pick up later edits to the repository.

.PARAMETER Scope
  project - only this repository's .agents and .claude roots
  user    - only your home-directory roots
  both    - default

.PARAMETER Copy
  Copy instead of linking. Use when linking is unavailable.

.EXAMPLE
  pwsh -File scripts/install.ps1
  pwsh -File scripts/install.ps1 -Scope user
  pwsh -File scripts/install.ps1 -Copy
#>
[CmdletBinding()]
param(
    [ValidateSet('project', 'user', 'both')]
    [string]$Scope = 'both',

    [switch]$Copy
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$skillName = 'eagle-sdd'
$source = Join-Path $repoRoot "skills\$skillName"

if (-not (Test-Path $source -PathType Container)) {
    throw "Skill source not found: $source"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$created = 0
$skipped = 0
$copied = 0

function Install-One {
    param([string]$Root, [string]$Label)

    $parent = Split-Path $Root -Parent
    $target = Join-Path $Root $skillName

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    if (Test-Path $target) {
        $item = Get-Item $target -Force
        $existing = $null
        if ($item.LinkType) {
            # Target is a string array in Windows PowerShell, a string in pwsh 7.
            $existing = @($item.Target) | Select-Object -First 1
        }

        # Compare resolved STRINGS. Windows PowerShell's PathInfo does not
        # implement value equality, so `$a -eq $b` is false for identical paths
        # and every re-run would needlessly replace a correct link.
        $alreadyCorrect = $false
        if ($existing) {
            $resolvedExisting = Resolve-Path -LiteralPath $existing -ErrorAction SilentlyContinue
            $resolvedSource = Resolve-Path -LiteralPath $source -ErrorAction SilentlyContinue
            if ($resolvedExisting -and $resolvedSource -and
                $resolvedExisting.Path -ieq $resolvedSource.Path) {
                $alreadyCorrect = $true
            }
        }

        if ($alreadyCorrect) {
            Write-Host "  = $Label  (already linked)" -ForegroundColor DarkGray
            $script:skipped++
            return
        }

        $aside = "$target.pre-eagle-sdd-$stamp"
        Move-Item -LiteralPath $target -Destination $aside
        Write-Host "  ! $Label  (existing entry moved to $(Split-Path $aside -Leaf))" -ForegroundColor Yellow
    }

    if (-not $Copy) {
        try {
            New-Item -ItemType Junction -Path $target -Target $source -ErrorAction Stop | Out-Null
            Write-Host "  + $Label" -ForegroundColor Green
            $script:created++
            return
        }
        catch {
            Write-Host "  ~ $Label  (junction unavailable, copying)" -ForegroundColor Yellow
        }
    }

    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
    Write-Host "  + $Label  (copy)" -ForegroundColor Green
    $script:copied++
}

$targets = @()

if ($Scope -eq 'project' -or $Scope -eq 'both') {
    # .agents is read by Codex, Copilot CLI, Gemini CLI, and DeepSeek Harness.
    $targets += [pscustomobject]@{ Root = (Join-Path $repoRoot '.agents\skills'); Label = '.agents/skills            project' }
    # Claude Code reads its own root and does not recognise .agents.
    $targets += [pscustomobject]@{ Root = (Join-Path $repoRoot '.claude\skills'); Label = '.claude/skills            project' }
}

if ($Scope -eq 'user' -or $Scope -eq 'both') {
    $targets += [pscustomobject]@{ Root = (Join-Path $HOME '.agents\skills'); Label = '~/.agents/skills           user' }
    $targets += [pscustomobject]@{ Root = (Join-Path $HOME '.claude\skills'); Label = '~/.claude/skills           user' }
    $targets += [pscustomobject]@{ Root = (Join-Path $HOME '.dsh\skills'); Label = '~/.dsh/skills              user' }
    $targets += [pscustomobject]@{ Root = (Join-Path $HOME '.copilot\skills'); Label = '~/.copilot/skills          user' }
}

Write-Host ""
Write-Host "Installing '$skillName' from $source" -ForegroundColor Cyan
Write-Host ""

foreach ($t in $targets) {
    Install-One -Root $t.Root -Label $t.Label
}

Write-Host ""
Write-Host "linked $created, copied $copied, already present $skipped"

if ($copied -gt 0) {
    Write-Host ""
    Write-Host "Copies do not track later edits. Re-run this script after changing the skill." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Verify in a fresh agent session:" -ForegroundColor Cyan
Write-Host "  Claude Code          /eagle-sdd"
Write-Host "  DeepSeek Harness     /eagle-sdd"
Write-Host "  Codex                the skill appears in the skill listing; it will not auto-trigger"
